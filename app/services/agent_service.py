"""DeepAgents 统一智能体服务 - v2.1 架构

核心设计原则：
- 智能体完全自主决策输出方式
- 提供"输出工具"让智能体显式控制展示
- 前端只做渲染，不预设展示逻辑
"""

import json
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Optional, List, Literal
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
class ContentBlockEvent(SSEEvent):
    """内容块事件 - 智能体决定展示的内容"""
    type: str = "content_block"
    block_type: str = None  # "table" | "chart"
    # table 类型
    columns: Optional[List[str]] = None
    rows: Optional[List[List[Any]]] = None
    # chart 类型
    option: Optional[dict] = None
    # 通用
    title: Optional[str] = None


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

SYSTEM_PROMPT = """你是 SmartNum 数据分析助手。

## 目标
帮助用户查询和分析数据库中的数据。

## 可用工具
- get_schema: 获取数据库表结构
- run_sql: 执行 SQL 查询
- present_table: 向用户展示表格数据
- present_chart: 向用户展示图表

根据用户需求自主决定如何回答。
"""


# ==================== 核心工具定义 ====================

def get_schema(
    datasource_id: str,
    table_pattern: Optional[str] = None,
) -> str:
    """
    获取数据库表结构。

    Args:
        datasource_id: 数据源ID
        table_pattern: 表名过滤模式（可选，支持 % 通配符）

    Returns:
        数据库表结构信息（Markdown 格式）
    """

    async def _get_schema():
        from app.services import datasource_service
        schema_info = await datasource_service.get_schema(datasource_id)
        if schema_info is None:
            return "错误: 数据源不存在或无法获取 Schema"

        lines = ["# 数据库 Schema\n"]
        import fnmatch

        for table in schema_info.tables:
            table_name = table.name

            if table_pattern:
                if not fnmatch.fnmatch(table_name.lower(), table_pattern.lower()):
                    continue

            table_comment = table.comment or ""
            lines.append(f"\n## 表: {table_name}")
            if table_comment:
                lines.append(f"说明: {table_comment}")

            lines.append("\n| 列名 | 类型 | 可空 | 键 | 说明 |")
            lines.append("|------|------|------|-----|------|")

            for col in table.columns:
                nullable = "是" if col.nullable else "否"
                key = col.key or "-"
                comment = col.comment or "-"
                lines.append(f"| {col.name} | {col.type} | {nullable} | {key} | {comment} |")

        return "\n".join(lines)

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, _get_schema())
            return future.result()
    else:
        return loop.run_until_complete(_get_schema())


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
        查询结果，包含 columns（列名列表）、rows（数据行）、total（总数）、truncated（是否截断）
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

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, _execute())
            return future.result()
    else:
        return loop.run_until_complete(_execute())


def present_table(
    columns: List[str],
    rows: List[List[Any]],
    title: Optional[str] = None,
) -> str:
    """
    向用户展示表格数据。

    当你需要以表格形式向用户展示数据时调用此工具。

    Args:
        columns: 列名列表，如 ["产品名", "销售额", "数量"]
        rows: 数据行列表，每行是一个值列表，如 [["产品A", 1000, 50], ["产品B", 2000, 30]]
        title: 表格标题（可选）

    Returns:
        确认信息
    """
    # 实际处理在 process_query_stream 中
    return f"已展示表格（{len(rows)} 行）"


def present_chart(
    option: dict,
    title: Optional[str] = None,
) -> str:
    """
    向用户展示图表。

    当你需要以图表形式向用户展示数据时调用此工具。
    你需要自己生成 ECharts 的 option 配置。

    Args:
        option: ECharts 图表配置，必须包含 series 字段
        title: 图表标题（可选）

    Returns:
        成功返回确认信息，失败返回错误提示

    ECharts option 示例:
    {
        "xAxis": {"type": "category", "data": ["A", "B", "C"]},
        "yAxis": {"type": "value"},
        "series": [{"type": "bar", "data": [100, 200, 150]}]
    }
    """
    import json

    # 校验 option 是否为有效字典
    if not isinstance(option, dict):
        return "错误：option 必须是一个有效的 JSON 对象"

    # 校验 option 是否可以序列化为 JSON
    try:
        json.dumps(option)
    except (TypeError, ValueError) as e:
        return f"错误：option 包含无法序列化的数据: {str(e)}"

    # 校验必要字段
    if "series" not in option:
        return "错误：option 必须包含 series 字段"

    if not isinstance(option["series"], list) or len(option["series"]) == 0:
        return "错误：series 必须是非空数组"

    # 校验每个 series 是否有 type 和 data
    for i, s in enumerate(option["series"]):
        if not isinstance(s, dict):
            return f"错误：series[{i}] 必须是对象"
        if "type" not in s:
            return f"错误：series[{i}] 缺少 type 字段"
        if "data" not in s:
            return f"错误：series[{i}] 缺少 data 字段"

    return "图表配置有效，已展示给用户"


# ==================== DeepAgent 创建 ====================

_agent = None


def get_agent():
    """获取 DeepAgent 单例"""
    global _agent
    if _agent is not None:
        return _agent

    from deepagents import create_deep_agent
    from langchain_openai import ChatOpenAI

    # 创建 OpenAI 兼容的 LLM（支持阿里百炼等）
    llm = ChatOpenAI(
        model=settings.llm_model_name,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
    )

    # 创建智能体 - 使用新的工具集
    _agent = create_deep_agent(
        name="smartnum-agent",
        model=llm,
        tools=[get_schema, run_sql, present_table, present_chart],
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
    """流式处理用户查询 - v2.1 智能体自主输出架构"""

    # 发送思考事件
    yield ThinkingEvent(content="正在分析您的问题...").to_dict()

    # 使用 DeepAgent 流式处理
    agent = get_agent()

    # 使用唯一的 thread_id 确保每次调用独立
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    # 构建消息 - 包含历史对话以保持上下文
    messages = []
    for msg in history[-10:]:
        role = msg.get("role", "user")
        # 从 blocks 中提取文字内容
        blocks = msg.get("blocks", [])
        text_content = ""
        for block in blocks:
            if block.get("type") == "text":
                text_content = block.get("content", "")
                break
        # 兼容旧格式
        if not text_content:
            text_content = msg.get("content", "")
        if text_content:
            messages.append({"role": role, "content": text_content})

    # 添加数据源上下文（作为系统提示的一部分，不是用户问题）
    messages.append({
        "role": "system",
        "content": f"当前数据源ID: {datasource_id}。调用工具时使用此ID。",
    })

    # 添加当前问题
    messages.append({"role": "user", "content": query})

    try:
        # 用于收集最终结果
        final_result = {
            "content": "",
            "sql": None,
            "blocks": [],  # 新增：内容块列表
            "error": None,
        }

        # 当前 SQL 查询的结果缓存
        current_sql_result = None

        # 流式调用
        for chunk in agent.stream({"messages": messages}, config=config):
            event = _parse_agent_chunk(chunk)

            if event:
                # [DEBUG] 打印事件类型和内容
                print(f"\n[DEBUG] Event type: {type(event).__name__}")
                if isinstance(event, MessageEvent):
                    print(f"[DEBUG] MessageEvent content repr: {repr(event.content)}")
                    print(f"[DEBUG] MessageEvent content length: {len(event.content) if event.content else 0}")

                # 收集消息内容（避免重复添加）
                if isinstance(event, MessageEvent) and event.content:
                    final_result["content"] = event.content
                    # 只有当最后一个 block 不是 text 时才添加
                    if not final_result["blocks"] or final_result["blocks"][-1].get("type") != "text":
                        final_result["blocks"].append({
                            "type": "text",
                            "content": event.content
                        })
                    else:
                        # 更新最后一个 text block 的内容
                        final_result["blocks"][-1]["content"] = event.content

                # 处理 SQL 相关事件
                if isinstance(event, ToolCallEvent) and event.tool == "run_sql":
                    sql = event.input.get("sql", "") if event.input else ""
                    if sql:
                        final_result["sql"] = sql
                        yield SQLGenerationEvent(sql=sql).to_dict()
                        yield SQLExecutionEvent(status="running").to_dict()

                # 缓存 run_sql 结果
                if isinstance(event, ToolResultEvent) and event.tool == "run_sql":
                    yield SQLExecutionEvent(status="completed").to_dict()
                    try:
                        result_data = json.loads(event.output) if event.output else {}
                        if result_data.get("success"):
                            current_sql_result = {
                                "columns": result_data.get("columns", []),
                                "rows": result_data.get("rows", []),
                                "total": result_data.get("total", 0),
                                "truncated": result_data.get("truncated", False),
                            }
                    except:
                        pass

                # 处理 present_table 工具调用 - 智能体决定展示表格
                if isinstance(event, ToolCallEvent) and event.tool == "present_table":
                    columns = event.input.get("columns", []) if event.input else []
                    rows = event.input.get("rows", []) if event.input else []
                    title = event.input.get("title", "") if event.input else ""

                    block = {
                        "type": "table",
                        "data": {
                            "columns": columns,
                            "rows": rows,
                            "total": len(rows),
                            "truncated": False,
                        },
                        "title": title,
                    }
                    final_result["blocks"].append(block)
                    yield ContentBlockEvent(
                        block_type="table",
                        columns=columns,
                        rows=rows,
                        title=title,
                    ).to_dict()

                # 处理 present_chart 工具调用 - 智能体决定展示图表
                if isinstance(event, ToolCallEvent) and event.tool == "present_chart":
                    option = event.input.get("option", {}) if event.input else {}
                    title = event.input.get("title", "") if event.input else ""

                    block = {
                        "type": "chart",
                        "option": option,
                        "title": title,
                    }
                    final_result["blocks"].append(block)
                    yield ContentBlockEvent(
                        block_type="chart",
                        option=option,
                        title=title,
                    ).to_dict()

                yield event.to_dict()

        # 发送完成事件，包含最终结果
        yield {"type": "done", "message": "处理完成", "data": final_result}

    except Exception as e:
        yield ErrorEvent(message=f"处理出错: {str(e)}").to_dict()
        yield DoneEvent(message="处理结束").to_dict()


def _parse_agent_chunk(chunk: dict) -> Optional[SSEEvent]:
    """解析 Agent 输出的 chunk，转换为 SSE 事件"""

    # [DEBUG] 打印原始 chunk 结构
    print(f"\n[DEBUG] _parse_agent_chunk received keys: {list(chunk.keys())}")

    # DeepAgents 的 chunk 是嵌套结构，需要遍历查找 messages
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

                    # 只处理 AI 消息，过滤掉 human/user 消息
                    # LangChain 消息类型: "human", "ai", "tool", "system"
                    if msg_type == "human":
                        # 这是用户消息，不应该作为 AI 回复返回
                        return None

                    # 普通 AI 消息，有内容才返回
                    if content and isinstance(content, str) and content.strip():
                        # [DEBUG] 打印 AI 消息内容
                        print(f"[DEBUG] AI message type: {msg_type}")
                        print(f"[DEBUG] AI message content repr: {repr(content[:200])}...")
                        print(f"[DEBUG] Newlines in content: {content.count(chr(10))}")
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

                    # 只处理 AI 消息，过滤掉 human/user 消息
                    if msg_type == "human":
                        return None

                    if msg_content and isinstance(msg_content, str) and msg_content.strip():
                        # [DEBUG] 打印字典格式 AI 消息内容
                        print(f"[DEBUG] Dict AI message type: {msg_type}")
                        print(f"[DEBUG] Dict AI message content repr: {repr(msg_content[:200])}...")
                        print(f"[DEBUG] Newlines in dict content: {msg_content.count(chr(10))}")
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
        elif event.get("type") == "content_block":
            if result is None:
                result = {}
            if "blocks" not in result:
                result["blocks"] = []
            result["blocks"].append({
                "type": event.get("block_type"),
                "data": event.get("data"),
                "chart_type": event.get("chart_type"),
                "option": event.get("option"),
                "title": event.get("title"),
            })

    return result or {"content": "处理完成", "error": None}