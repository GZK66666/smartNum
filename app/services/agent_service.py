"""DeepAgents 统一智能体服务 - v2.2 简化架构

核心设计原则：
- 智能体专注于回答用户问题
- 提供细粒度的 Schema 查询工具，实现渐进式上下文加载
- 去除展示控制工具，让智能体自由输出
"""

import json
import re
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Optional, List
from dataclasses import dataclass, asdict
import asyncio

from app.core import get_settings

settings = get_settings()


# ==================== SSE 事件类型定义 ====================

@dataclass
class SSEEvent:
    """SSE 事件基类"""
    type: str
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class ThinkingEvent(SSEEvent):
    """思考事件"""
    type: str = "thinking"
    content: str = None


@dataclass
class PlanEvent(SSEEvent):
    """计划事件"""
    type: str = "plan"
    todos: List[dict] = None


@dataclass
class ToolCallEvent(SSEEvent):
    """工具调用事件"""
    type: str = "tool_call"
    tool: str = None
    input: dict = None
    id: str = None


@dataclass
class ToolResultEvent(SSEEvent):
    """工具结果事件"""
    type: str = "tool_result"
    tool: str = None
    id: str = None
    output: str = None


@dataclass
class SQLGenerationEvent(SSEEvent):
    """SQL 生成事件"""
    type: str = "sql_generation"
    sql: str = None


@dataclass
class SQLExecutionEvent(SSEEvent):
    """SQL 执行事件"""
    type: str = "sql_execution"
    status: str = None
    duration: float = None


@dataclass
class MessageEvent(SSEEvent):
    """消息事件"""
    type: str = "message"
    content: str = None


@dataclass
class ErrorEvent(SSEEvent):
    """错误事件"""
    type: str = "error"
    message: str = None
    code: str = None


@dataclass
class DoneEvent(SSEEvent):
    """完成事件"""
    type: str = "done"
    message: str = "处理完成"


# ==================== 系统提示词 ====================

SYSTEM_PROMPT = """你是 SmartNum 数据分析助手，专门帮助用户查询和分析数据库中的数据。

## 工作流程（渐进式上下文加载）

**重要**：不要一次性加载所有表结构，按需逐步查询，避免上下文溢出。

1. **列出表名**：先用 `list_tables` 查看有哪些表可用（返回信息精简）
2. **按需查结构**：根据用户问题，只调用 `get_table_schema` 查询相关表的结构
3. **执行查询**：使用 `run_sql` 执行 SQL 获取数据
4. **回答问题**：用自然语言回答，数据结果用 Markdown 表格展示

## 错误处理与迭代修复

**当工具调用失败时，不要直接返回错误，要分析原因并重试：**

1. **SQL 执行失败**：
   - 分析错误信息（如语法错误、表不存在、列不存在等）
   - 检查表名/列名是否正确，可能需要重新调用 `get_table_schema` 确认结构
   - 修正 SQL 后重新执行
   - 最多重试 3 次

2. **Schema 查询失败**：
   - 检查表名是否正确，可用 `list_tables` 确认
   - 表名大小写敏感问题需注意

3. **结果为空**：
   - 检查查询条件是否过于严格
   - 考虑放宽条件或检查数据是否存在

**示例错误处理流程**：
```
用户: 查询用户表的前10条
→ list_tables() → 发现有 users 表
→ get_table_schema("users") → 获取列信息
→ run_sql("SELECT * FROM user LIMIT 10") → 报错: Table 'user' doesn't exist
→ 分析错误: 表名应该是 'users' 不是 'user'
→ run_sql("SELECT * FROM users LIMIT 10") → 成功
→ 返回结果
```

## 工具说明

### list_tables
列出数据库所有表名和注释。返回精简信息，不包含列详情。
**在查询数据前必须先调用此工具了解有哪些表。**

### get_table_schema
获取指定表的详细结构（列名、类型、注释）。
**只在确定相关表后才调用，避免加载无关表结构。**

### run_sql
执行 SQL SELECT 查询并返回结果。只支持 SELECT 语句。
**返回结果包含 success 字段，失败时会返回 error 信息。**

## 输出规则

1. 数据结果用 Markdown 表格展示
2. 用简洁的自然语言解读关键发现
3. 直接回答用户的问题

## 安全规则

- 只生成 SELECT 语句，禁止 DELETE/UPDATE/INSERT
- 不查询敏感数据（如密码、身份证号）
"""


# ==================== 核心工具定义 ====================

def list_tables(datasource_id: str) -> str:
    """
    列出数据库中所有表的名称和注释。

    在查询数据前，先调用此工具了解有哪些表可用。
    返回简洁的表列表，不包含列信息。

    Args:
        datasource_id: 数据源ID

    Returns:
        表名和注释列表（Markdown 格式）
    """

    async def _list_tables():
        from app.services import datasource_service, db_service

        ds = await datasource_service.get_datasource(datasource_id)
        if ds is None:
            return "错误: 数据源不存在"

        # 获取简化的表信息（只包含表名和注释）
        url = db_service.get_database_url(
            ds["type"].value,
            ds["host"],
            ds["port"],
            ds["database"],
            ds["username"],
            ds["password"],
        )

        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        engine = create_async_engine(url, echo=False)

        try:
            async with engine.connect() as conn:
                lines = ["# 数据库表列表\n"]
                lines.append("| 序号 | 表名 | 说明 |")
                lines.append("|------|------|------|")

                if ds["type"].value == "mysql":
                    result = await conn.execute(
                        text("""
                            SELECT TABLE_NAME, TABLE_COMMENT
                            FROM information_schema.TABLES
                            WHERE TABLE_SCHEMA = :db
                            ORDER BY TABLE_NAME
                        """),
                        {"db": ds["database"]},
                    )
                    rows = result.fetchall()

                    for i, row in enumerate(rows, 1):
                        table_name = row[0]
                        table_comment = row[1] or "-"
                        lines.append(f"| {i} | {table_name} | {table_comment} |")

                elif ds["type"].value == "postgresql":
                    schema = ds.get("schema_name") or "public"
                    result = await conn.execute(
                        text("""
                            SELECT table_name, obj_description((table_schema || '.' || table_name)::regclass) as table_comment
                            FROM information_schema.tables
                            WHERE table_schema = :schema AND table_type = 'BASE TABLE'
                            ORDER BY table_name
                        """),
                        {"schema": schema},
                    )
                    rows = result.fetchall()

                    for i, row in enumerate(rows, 1):
                        table_name = row[0]
                        table_comment = row[1] or "-"
                        lines.append(f"| {i} | {table_name} | {table_comment} |")

                elif ds["type"].value == "sqlite":
                    result = await conn.execute(
                        text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
                    )
                    rows = result.fetchall()

                    for i, row in enumerate(rows, 1):
                        table_name = row[0]
                        lines.append(f"| {i} | {table_name} | - |")

                return "\n".join(lines)

        finally:
            await engine.dispose()

    return _run_async(_list_tables)


def get_table_schema(
    datasource_id: str,
    table_name: str,
) -> str:
    """
    获取指定表的详细结构信息。

    当你需要了解某个表的列名、类型、注释等信息时调用此工具。
    建议只查询与用户问题相关的表，避免加载过多信息。

    Args:
        datasource_id: 数据源ID
        table_name: 表名

    Returns:
        表结构信息（Markdown 格式），包含列名、类型、注释等
    """

    async def _get_table_schema():
        from app.services import datasource_service, db_service

        ds = await datasource_service.get_datasource(datasource_id)
        if ds is None:
            return "错误: 数据源不存在"

        url = db_service.get_database_url(
            ds["type"].value,
            ds["host"],
            ds["port"],
            ds["database"],
            ds["username"],
            ds["password"],
        )

        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        engine = create_async_engine(url, echo=False)

        try:
            async with engine.connect() as conn:
                lines = [f"# 表结构: {table_name}\n"]

                if ds["type"].value == "mysql":
                    # 获取表注释
                    table_result = await conn.execute(
                        text("""
                            SELECT TABLE_COMMENT
                            FROM information_schema.TABLES
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table
                        """),
                        {"db": ds["database"], "table": table_name},
                    )
                    table_row = table_result.fetchone()
                    if table_row and table_row[0]:
                        lines.append(f"**表说明**: {table_row[0]}\n")

                    # 获取列信息
                    columns_result = await conn.execute(
                        text("""
                            SELECT
                                COLUMN_NAME,
                                COLUMN_TYPE,
                                IS_NULLABLE,
                                COLUMN_KEY,
                                COLUMN_DEFAULT,
                                COLUMN_COMMENT
                            FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table
                            ORDER BY ORDINAL_POSITION
                        """),
                        {"db": ds["database"], "table": table_name},
                    )
                    column_rows = columns_result.fetchall()

                    lines.append("\n| 列名 | 类型 | 可空 | 键 | 默认值 | 说明 |")
                    lines.append("|------|------|------|-----|--------|------|")

                    for col in column_rows:
                        col_name = col[0]
                        col_type = col[1]
                        nullable = "是" if col[2] == "YES" else "否"
                        col_key = col[3] or "-"
                        col_default = col[4] or "-"
                        col_comment = col[5] or "-"
                        lines.append(f"| {col_name} | {col_type} | {nullable} | {col_key} | {col_default} | {col_comment} |")

                elif ds["type"].value == "postgresql":
                    schema = ds.get("schema_name") or "public"

                    # 获取列信息
                    columns_result = await conn.execute(
                        text("""
                            SELECT
                                column_name,
                                data_type || COALESCE('(' || character_maximum_length || ')', ''),
                                is_nullable,
                                NULL as column_key,
                                column_default,
                                col_description((table_schema || '.' || table_name)::regclass, ordinal_position)
                            FROM information_schema.columns
                            WHERE table_schema = :schema AND table_name = :table
                            ORDER BY ordinal_position
                        """),
                        {"schema": schema, "table": table_name},
                    )
                    column_rows = columns_result.fetchall()

                    lines.append("\n| 列名 | 类型 | 可空 | 键 | 默认值 | 说明 |")
                    lines.append("|------|------|------|-----|--------|------|")

                    for col in column_rows:
                        col_name = col[0]
                        col_type = col[1]
                        nullable = "是" if col[2] == "YES" else "否"
                        col_key = col[3] or "-"
                        col_default = col[4] or "-"
                        col_comment = col[5] or "-"
                        lines.append(f"| {col_name} | {col_type} | {nullable} | {col_key} | {col_default} | {col_comment} |")

                elif ds["type"].value == "sqlite":
                    # 获取表结构
                    pragma_result = await conn.execute(
                        text(f"PRAGMA table_info({table_name})")
                    )
                    column_rows = pragma_result.fetchall()

                    lines.append("\n| 列名 | 类型 | 可空 | 主键 | 默认值 |")
                    lines.append("|------|------|------|------|--------|")

                    for col in column_rows:
                        col_name = col[1]
                        col_type = col[2] or "-"
                        nullable = "否" if col[3] == 1 else "是"
                        is_pk = "是" if col[5] == 1 else "否"
                        col_default = col[4] or "-"
                        lines.append(f"| {col_name} | {col_type} | {nullable} | {is_pk} | {col_default} |")

                return "\n".join(lines)

        except Exception as e:
            return f"错误: 获取表结构失败 - {str(e)}"

        finally:
            await engine.dispose()

    return _run_async(_get_table_schema)


def run_sql(
    datasource_id: str,
    sql: str,
    limit: int = 1000,
) -> dict:
    """
    执行 SQL 查询。

    Args:
        datasource_id: 数据源ID
        sql: SQL 查询语句（仅支持 SELECT）
        limit: 最大返回行数

    Returns:
        查询结果，包含 success、columns、rows、total、truncated、error
    """

    async def _execute():
        from app.services import datasource_service, db_service

        ds = await datasource_service.get_datasource(datasource_id)
        if ds is None:
            return {"success": False, "error": "数据源不存在"}

        result = await db_service.execute_query(
            db_type=ds["type"].value,
            host=ds["host"],
            port=ds["port"],
            database=ds["database"],
            username=ds["username"],
            password=ds["password"],
            sql=sql,
            max_rows=limit,
        )
        return result

    return _run_async(_execute)


def _run_async(coro_func):
    """辅助函数：在同步上下文中运行异步函数

    Args:
        coro_func: 一个无参数的异步函数，返回协程
    """
    try:
        # 尝试获取当前运行中的事件循环
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None:
        # 已有运行中的事件循环，需要在新线程中运行
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, coro_func())
            return future.result()
    else:
        # 没有运行中的事件循环，直接运行
        return asyncio.run(coro_func())


# ==================== DeepAgent 创建 ====================

_agent = None


def get_agent():
    """获取 DeepAgent 单例"""
    global _agent
    if _agent is not None:
        return _agent

    from deepagents import create_deep_agent
    from langchain_openai import ChatOpenAI

    # 创建 OpenAI 兼容的 LLM
    llm = ChatOpenAI(
        model=settings.llm_model_name,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
    )

    # 创建智能体 - 使用简化的工具集
    _agent = create_deep_agent(
        name="smartnum-agent",
        model=llm,
        tools=[list_tables, get_table_schema, run_sql],
        system_prompt=SYSTEM_PROMPT,
    )

    return _agent


# ==================== SSE 流式处理 ====================

async def process_query_stream(
    datasource_id: str,
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    schema_name: Optional[str],
    query: str,
    context: dict,
    history: list[dict],
) -> AsyncGenerator[dict, None]:
    """流式处理用户查询 - v2.2 简化架构"""

    # 发送思考事件
    yield ThinkingEvent(content="正在分析您的问题...").to_dict()

    # 使用 DeepAgent 流式处理
    agent = get_agent()

    # 使用唯一的 thread_id
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    # 构建消息
    messages = []
    for msg in history[-10:]:
        role = msg.get("role", "user")
        blocks = msg.get("blocks", [])
        text_content = ""
        for block in blocks:
            if block.get("type") == "text":
                text_content = block.get("content", "")
                break
        if not text_content:
            text_content = msg.get("content", "")
        if text_content:
            messages.append({"role": role, "content": text_content})

    # 添加数据源上下文
    messages.append({
        "role": "system",
        "content": f"当前数据源ID: {datasource_id}。调用工具时使用此ID。",
    })

    # 添加当前问题
    messages.append({"role": "user", "content": query})

    try:
        # 最终结果
        final_result = {
            "content": "",
            "sql": None,
            "error": None,
        }

        # 流式调用
        for chunk in agent.stream({"messages": messages}, config=config):
            event = _parse_agent_chunk(chunk)

            if event:
                # 收集消息内容
                if isinstance(event, MessageEvent) and event.content:
                    final_result["content"] = event.content

                # 处理 SQL 相关事件
                if isinstance(event, ToolCallEvent) and event.tool == "run_sql":
                    sql = event.input.get("sql", "") if event.input else ""
                    if sql:
                        final_result["sql"] = sql
                        yield SQLGenerationEvent(sql=sql).to_dict()
                        yield SQLExecutionEvent(status="running").to_dict()

                # 处理 run_sql 结果
                if isinstance(event, ToolResultEvent) and event.tool == "run_sql":
                    yield SQLExecutionEvent(status="completed").to_dict()

                yield event.to_dict()

        # 发送完成事件
        yield {"type": "done", "message": "处理完成", "data": final_result}

    except Exception as e:
        yield ErrorEvent(message=f"处理出错: {str(e)}").to_dict()
        yield DoneEvent(message="处理结束").to_dict()


def _parse_agent_chunk(chunk: dict) -> Optional[SSEEvent]:
    """解析 Agent 输出的 chunk，转换为 SSE 事件"""

    # DeepAgents 的 chunk 是嵌套结构
    for key, value in chunk.items():
        if isinstance(value, dict) and "messages" in value:
            messages = value["messages"]

            # 处理 LangGraph 的 Overwrite 对象
            if hasattr(messages, "value"):
                messages = messages.value
            elif not isinstance(messages, (list, tuple)):
                try:
                    messages = list(messages) if messages else []
                except:
                    messages = []

            if messages:
                last_msg = messages[-1]

                # 处理 LangChain 消息对象
                if hasattr(last_msg, "content"):
                    content = last_msg.content

                    # 检查是否有工具调用
                    tool_calls = getattr(last_msg, "tool_calls", None)
                    if tool_calls:
                        tc = tool_calls[-1]
                        if isinstance(tc, dict):
                            return ToolCallEvent(
                                tool=tc.get("name", "unknown"),
                                input=tc.get("args", {}),
                                id=tc.get("id", str(uuid.uuid4()))
                            )
                        else:
                            return ToolCallEvent(
                                tool=getattr(tc, "name", "unknown"),
                                input=getattr(tc, "args", {}) or {},
                                id=getattr(tc, "id", str(uuid.uuid4()))
                            )

                    # 检查是否是工具结果消息
                    msg_type = getattr(last_msg, "type", None)
                    msg_name = getattr(last_msg, "name", None)
                    if msg_type == "tool" and msg_name:
                        return ToolResultEvent(
                            tool=msg_name,
                            id=str(uuid.uuid4()),
                            output=str(content)[:500] if content else ""
                        )

                    # 过滤掉 human/user 消息
                    if msg_type == "human":
                        return None

                    # 普通 AI 消息
                    if content and isinstance(content, str) and content.strip():
                        return MessageEvent(content=content)

                # 处理字典格式的消息
                elif isinstance(last_msg, dict):
                    msg_content = last_msg.get("content", "")
                    tool_calls = last_msg.get("tool_calls", [])
                    msg_type = last_msg.get("type", "")
                    msg_name = last_msg.get("name", "")

                    if tool_calls:
                        tc = tool_calls[-1]
                        return ToolCallEvent(
                            tool=tc.get("name", msg_name or "unknown"),
                            input=tc.get("args", {}),
                            id=tc.get("id", str(uuid.uuid4()))
                        )

                    if msg_type == "tool":
                        return ToolResultEvent(
                            tool=msg_name,
                            id=str(uuid.uuid4()),
                            output=str(msg_content)[:500] if msg_content else ""
                        )

                    if msg_type == "human":
                        return None

                    if msg_content and isinstance(msg_content, str) and msg_content.strip():
                        return MessageEvent(content=msg_content)

    # 处理 todos 事件
    if "todos" in chunk:
        return PlanEvent(todos=chunk["todos"])

    return None


# ==================== 兼容性接口 ====================

async def process_query(
    datasource_id: str,
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    schema_name: Optional[str],
    query: str,
    context: dict,
    history: list[dict],
) -> dict:
    """非流式处理用户查询（兼容性接口）"""
    result = None

    async for event in process_query_stream(
        datasource_id, db_type, host, port, database,
        username, password, schema_name, query, context, history
    ):
        if event.get("type") == "message":
            result = {"content": event.get("content")}
        elif event.get("type") == "sql_generation":
            if result is None:
                result = {}
            result["sql"] = event.get("sql")

    return result or {"content": "处理完成", "error": None}