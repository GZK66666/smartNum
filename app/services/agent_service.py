"""DeepAgents Text2SQL 智能体服务"""

import json
from typing import Any, AsyncGenerator, Optional

from app.core import get_settings
from app.services import db_service, datasource_service

settings = get_settings()

# Schema 缓存
_schema_cache: dict[str, dict] = {}


def _get_llm():
    """获取 LLM 实例 (OpenAI 兼容格式)"""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=settings.llm_model_name,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
    )


# ==================== 智能体工具 ====================

def explore_schema_tool(
    datasource_id: str,
    table_pattern: Optional[str] = None,
    column_pattern: Optional[str] = None,
) -> str:
    """
    探索数据库 Schema，支持模糊匹配表名和列名。

    Args:
        datasource_id: 数据源ID
        table_pattern: 表名匹配模式（支持通配符 %）
        column_pattern: 列名匹配模式（支持通配符 %）

    Returns:
        匹配的表结构信息（Markdown格式）
    """
    import asyncio

    async def _get_schema():
        schema_info = await datasource_service.get_schema(datasource_id)
        if schema_info is None:
            return "错误: 数据源不存在或无法获取 Schema"

        lines = ["# 数据库 Schema\n"]

        for table in schema_info.tables:
            table_name = table.name

            # 表名过滤
            if table_pattern:
                import fnmatch
                if not fnmatch.fnmatch(table_name.lower(), table_pattern.lower()):
                    continue

            table_comment = table.comment or ""
            lines.append(f"\n## 表: {table_name}")
            if table_comment:
                lines.append(f"说明: {table_comment}")

            lines.append("\n| 列名 | 类型 | 可空 | 键 | 说明 |")
            lines.append("|------|------|------|-----|------|")

            for col in table.columns:
                col_name = col.name

                # 列名过滤
                if column_pattern:
                    import fnmatch
                    if not fnmatch.fnmatch(col_name.lower(), column_pattern.lower()):
                        continue

                nullable = "是" if col.nullable else "否"
                key = col.key or "-"
                comment = col.comment or "-"

                lines.append(f"| {col_name} | {col.type} | {nullable} | {key} | {comment} |")

        return "\n".join(lines)

    # 运行异步函数
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        # 如果在异步上下文中，需要特殊处理
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, _get_schema())
            return future.result()
    else:
        return loop.run_until_complete(_get_schema())


def execute_sql_tool(
    datasource_id: str,
    sql: str,
    limit: int = 1000,
) -> dict:
    """
    执行 SQL 查询并返回结果。

    Args:
        datasource_id: 数据源ID
        sql: SQL 查询语句（仅支持 SELECT）
        limit: 最大返回行数

    Returns:
        查询结果，包含列名和数据行
    """
    import asyncio

    async def _execute():
        # 获取数据源
        ds = await datasource_service.get_datasource(datasource_id)
        if ds is None:
            return {
                "success": False,
                "error": "数据源不存在",
            }

        # 执行查询
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

    # 运行异步函数
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


# ==================== 智能体创建 ====================

def create_text2sql_agent():
    """创建 Text2SQL 智能体"""
    try:
        from deepagents import create_deep_agent
    except ImportError:
        # 如果 deepagents 不可用，返回 None
        return None

    system_prompt = """你是一个专业的数据分析师助手。你的任务是帮助用户通过自然语言查询数据库。

## 工作流程

1. **理解需求**：分析用户的问题，明确查询目标
2. **探索Schema**：使用 explore_schema_tool 工具了解表结构
3. **生成SQL**：根据 Schema 信息生成正确的 SQL
4. **执行查询**：使用 execute_sql_tool 工具执行查询
5. **解释结果**：用自然语言解释查询结果

## 工具使用

### explore_schema_tool
用于探索数据库结构：
- datasource_id: 数据源ID
- table_pattern: 表名过滤（可选，支持 % 通配符）
- column_pattern: 列名过滤（可选）

### execute_sql_tool
用于执行 SQL 查询：
- datasource_id: 数据源ID
- sql: SQL 语句（仅 SELECT）
- limit: 最大返回行数（默认 1000）

## 注意事项

- 只生成 SELECT 语句，禁止 DELETE/UPDATE/INSERT
- 对于复杂查询，先写子查询或 CTE
- 如果 Schema 信息不完整，主动探索相关表
- 解释结果时突出关键数据和趋势
- 如果用户追问，基于上下文修改 SQL

## 安全规则

- 不查询敏感表（如用户密码表）
- 不暴露敏感数据（如手机号、身份证）
- 大结果集自动截断，提示用户添加筛选条件
- 查询超时为 30 秒
"""

    # 使用 OpenAI 兼容的 LLM
    llm = _get_llm()

    agent = create_deep_agent(
        name="text2sql",
        tools=[explore_schema_tool, execute_sql_tool],
        system_prompt=system_prompt,
        llm=llm,
    )

    return agent


# 全局智能体实例
_agent = None


def get_agent():
    """获取智能体实例（单例）"""
    global _agent
    if _agent is None:
        _agent = create_text2sql_agent()
    return _agent


# ==================== 服务接口 ====================

def _format_schema_for_prompt(schema_info) -> str:
    """将 Schema 格式化为提示文本"""
    lines = []
    lines.append("# 数据库 Schema\n")

    for table in schema_info.tables:
        table_name = table.name
        table_comment = table.comment or ""
        lines.append(f"\n## 表: {table_name}")
        if table_comment:
            lines.append(f"说明: {table_comment}")

        lines.append("列:")
        for col in table.columns:
            col_name = col.name
            col_type = col.type
            col_comment = col.comment or ""
            nullable = "可空" if col.nullable else "非空"
            key_info = f" [{col.key}]" if col.key else ""

            col_desc = f"  - {col_name}: {col_type} ({nullable}){key_info}"
            if col_comment:
                col_desc += f" - {col_comment}"
            lines.append(col_desc)

    return "\n".join(lines)


async def _get_schema_text(datasource_id: str) -> str:
    """获取 Schema 信息文本"""
    from datetime import datetime, timedelta

    # 检查缓存
    if datasource_id in _schema_cache:
        cache = _schema_cache[datasource_id]
        if datetime.utcnow() - cache["loaded_at"] < timedelta(minutes=5):
            return cache["schema_text"]

    # 从服务获取
    schema_info = await datasource_service.get_schema(datasource_id)

    if schema_info is None:
        return "错误: 无法获取 Schema 信息"

    schema_text = _format_schema_for_prompt(schema_info)
    _schema_cache[datasource_id] = {
        "schema_text": schema_text,
        "loaded_at": datetime.utcnow(),
    }

    return schema_text


def _extract_sql(content: str) -> Optional[str]:
    """从响应中提取 SQL"""
    import re

    # 匹配 ```sql ... ``` 格式
    pattern = r"```sql\s*(.*?)\s*```"
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)

    if match:
        return match.group(1).strip()

    # 匹配 SELECT ... 语句
    pattern = r"(SELECT\s+.*?)(?:;|$)"
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)

    if match:
        return match.group(1).strip()

    return None


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
    """处理用户查询"""
    try:
        # 获取 Schema
        schema_text = await _get_schema_text(datasource_id)

        # 尝试使用 DeepAgents
        agent = get_agent()
        if agent is not None:
            # 使用 DeepAgents 框架
            messages = []
            for msg in history[-10:]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })
            messages.append({"role": "user", "content": query})

            # 调用智能体
            result = agent.invoke({
                "messages": messages,
                "datasource_id": datasource_id,
            })

            # 提取响应
            last_message = result.get("messages", [])[-1] if result.get("messages") else None
            if last_message:
                content = last_message.content if hasattr(last_message, 'content') else str(last_message)
            else:
                content = "未能生成响应"

            sql = _extract_sql(content)

            # 执行 SQL
            result_data = None
            if sql:
                query_result = await db_service.execute_query(
                    db_type=db_type,
                    host=host,
                    port=port,
                    database=database,
                    username=username,
                    password=password,
                    sql=sql,
                )

                if query_result["success"]:
                    result_data = {
                        "columns": query_result["columns"],
                        "rows": query_result["rows"],
                        "total": query_result["total"],
                        "truncated": query_result["truncated"],
                    }
                else:
                    return {
                        "content": f"SQL 执行失败: {query_result['error']}",
                        "sql": sql,
                        "error": query_result["error"],
                    }

            return {
                "content": content,
                "sql": sql,
                "result": result_data,
            }

        # 回退：使用 LangChain OpenAI 兼容格式调用
        llm = _get_llm()

        system_prompt = f"""你是一个专业的数据分析师助手。你的任务是帮助用户通过自然语言查询数据库。

{schema_text}

## 工作流程

1. **理解需求**：分析用户的问题，明确查询目标
2. **生成SQL**：根据 Schema 信息生成正确的 SQL
3. **解释结果**：用自然语言解释查询结果

## 注意事项

- 只生成 SELECT 语句，禁止 DELETE/UPDATE/INSERT
- 对于复杂查询，先写子查询或 CTE
- 如果用户追问，基于上下文修改 SQL
- 解释结果时突出关键数据和趋势

## 安全规则

- 不查询敏感表（如用户密码表）
- 不暴露敏感数据（如手机号、身份证）
- 大结果集自动截断，提示用户添加筛选条件
"""

        # 构建消息
        messages = [("system", system_prompt)]
        for msg in history[-10:]:
            messages.append((msg["role"], msg["content"]))

        # 添加当前问题
        messages.append(("user", query))

        response = await llm.ainvoke(messages)

        # 提取 SQL
        content = response.content
        sql = _extract_sql(content)

        # 执行 SQL
        result = None
        if sql:
            query_result = await db_service.execute_query(
                db_type=db_type,
                host=host,
                port=port,
                database=database,
                username=username,
                password=password,
                sql=sql,
            )

            if query_result["success"]:
                result = {
                    "columns": query_result["columns"],
                    "rows": query_result["rows"],
                    "total": query_result["total"],
                    "truncated": query_result["truncated"],
                }
            else:
                return {
                    "content": f"SQL 执行失败: {query_result['error']}",
                    "sql": sql,
                    "error": query_result["error"],
                }

        return {
            "content": content,
            "sql": sql,
            "result": result,
        }

    except Exception as e:
        return {
            "content": f"处理查询时出错: {str(e)}",
            "error": str(e),
        }


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
    """流式处理用户查询"""
    import json

    # 发送思考状态
    yield {
        "type": "thinking",
        "data": {"status": "analyzing", "message": "正在分析您的问题..."},
    }

    # 获取 Schema
    schema_text = await _get_schema_text(datasource_id)

    yield {
        "type": "thinking",
        "data": {"status": "generating_sql", "message": "正在生成 SQL 查询..."},
    }

    # 处理查询
    result = await process_query(
        datasource_id=datasource_id,
        db_type=db_type,
        host=host,
        port=port,
        database=database,
        username=username,
        password=password,
        schema_name=schema_name,
        query=query,
        context=context,
        history=history,
    )

    # 发送 SQL
    if result.get("sql"):
        yield {
            "type": "sql",
            "data": {"sql": result["sql"]},
        }

    # 发送结果
    if result.get("result"):
        yield {
            "type": "result",
            "data": result["result"],
        }

    # 发送完成
    yield {
        "type": "done",
        "data": result,
    }