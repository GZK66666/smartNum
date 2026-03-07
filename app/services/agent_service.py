"""DeepAgents Text2SQL 智能体服务 - v1.1 泛化智能体架构"""

import json
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Optional, List, Dict
from dataclasses import dataclass, asdict

from app.core import get_settings
from app.services import db_service, datasource_service
from app.agents.router_agent import route_question, AgentType, RouteResult
from app.agents.chitchat_agent import process_chitchat
from app.agents.analysis_agent import process_analysis, AnalysisResult

settings = get_settings()

# Schema 缓存
_schema_cache: dict[str, dict] = {}


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
class RouteEvent(SSEEvent):
    """路由事件"""
    type: str = "route"
    agent: str = None
    confidence: float = None


@dataclass
class ThinkingEvent(SSEEvent):
    """思考事件"""
    type: str = "thinking"
    content: str = None


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
class VisualizationEvent(SSEEvent):
    """可视化建议事件"""
    type: str = "visualization"
    suggestion: dict = None


@dataclass
class ResultEvent(SSEEvent):
    """结果事件"""
    type: str = "result"
    columns: List[str] = None
    rows: List[List[Any]] = None
    total: int = None
    truncated: bool = None


@dataclass
class MessageEvent(SSEEvent):
    """消息事件"""
    type: str = "message"
    content: str = None


@dataclass
class AnalysisEvent(SSEEvent):
    """分析事件"""
    type: str = "analysis"
    insights: List[dict] = None
    recommendations: List[str] = None
    summary: str = None


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


# ==================== 可视化建议 ====================

def _analyze_visualization_intent(question: str, columns: List[str], rows: List[List[Any]]) -> Optional[dict]:
    """
    分析可视化意图，生成图表建议。
    """
    if not columns or not rows:
        return None

    # 问题关键词
    question_lower = question.lower()

    # 检测图表类型意图
    chart_type = None
    confidence = 0.5

    # 趋势分析 -> 折线图
    if any(word in question_lower for word in ["趋势", "变化", "走势", "增长", "下降", "随时间"]):
        chart_type = "line"
        confidence = 0.85
    # 对比分析 -> 柱状图
    elif any(word in question_lower for word in ["对比", "比较", "各", "每个", "不同"]):
        chart_type = "bar"
        confidence = 0.85
    # 占比分析 -> 饼图
    elif any(word in question_lower for word in ["占比", "比例", "百分比", "构成"]):
        chart_type = "pie"
        confidence = 0.85
    # 排名分析 -> 横向柱状图
    elif any(word in question_lower for word in ["前", "排名", "最多", "最少", "top"]):
        chart_type = "bar"
        confidence = 0.8
    # 分布分析 -> 直方图
    elif any(word in question_lower for word in ["分布", "区间"]):
        chart_type = "histogram"
        confidence = 0.8
    # 关联分析 -> 散点图
    elif any(word in question_lower for word in ["关系", "相关", "影响"]):
        chart_type = "scatter"
        confidence = 0.8

    # 基于数据特征推断
    if chart_type is None:
        num_cols = len(columns)
        num_rows = len(rows)

        # 时间列检测
        time_keywords = ["date", "time", "日期", "时间", "year", "month", "day"]
        has_time_col = any(kw in col.lower() for col in columns for kw in time_keywords)

        # 数值列检测
        numeric_cols = []
        for i, col in enumerate(columns):
            if rows and isinstance(rows[0][i], (int, float)):
                numeric_cols.append(col)

        if has_time_col and numeric_cols:
            chart_type = "line"
            confidence = 0.75
        elif num_cols == 2 and numeric_cols:
            chart_type = "bar"
            confidence = 0.7
        elif len(numeric_cols) >= 2:
            chart_type = "scatter"
            confidence = 0.65
        else:
            return None  # 无法推断

    # 构建建议
    suggestion = {
        "chart_type": chart_type,
        "title": _generate_chart_title(question),
        "confidence": confidence,
    }

    # 设置坐标轴
    if columns:
        # 第一列通常是 X 轴（类别/时间）
        suggestion["x_axis"] = {
            "field": columns[0],
            "label": columns[0],
            "type": _infer_axis_type(columns[0], rows[0][0] if rows else None)
        }

        # 数值列作为 Y 轴
        for col in columns[1:]:
            if rows and isinstance(rows[0][columns.index(col)], (int, float)):
                suggestion["y_axis"] = {
                    "field": col,
                    "label": col,
                    "type": "number"
                }
                break

        if "y_axis" not in suggestion and len(columns) > 1:
            suggestion["y_axis"] = {
                "field": columns[1],
                "label": columns[1],
                "type": "number"
            }

    return suggestion


def _infer_axis_type(field_name: str, sample_value: Any) -> str:
    """推断坐标轴类型"""
    if sample_value is None:
        return "category"

    if isinstance(sample_value, (int, float)):
        # 检查是否是日期数值
        if isinstance(sample_value, int) and sample_value > 19000000:
            return "datetime"
        return "number"

    if isinstance(sample_value, str):
        # 检查是否是日期字符串
        if any(kw in field_name.lower() for kw in ["date", "time", "日期", "时间"]):
            return "datetime"

    return "category"


def _generate_chart_title(question: str) -> str:
    """生成图表标题"""
    # 简单处理：取问题前30个字符
    if len(question) > 30:
        return question[:30] + "..."
    return question


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


def _get_streaming_llm():
    """获取流式 LLM 实例"""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=settings.llm_model_name,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
        streaming=True,
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
    """流式处理用户查询 - v1.1 泛化智能体架构"""
    import time

    # 1. 路由判断
    yield RouteEvent(
        agent=AgentType.TEXT2SQL.value,
        confidence=0.0
    ).to_dict()

    # 使用路由智能体判断问题类型
    route_result = route_question(query, context)
    agent_type = route_result.agent

    # 发送路由结果
    yield RouteEvent(
        agent=agent_type.value,
        confidence=route_result.confidence
    ).to_dict()

    # 根据路由结果分发到不同智能体
    if agent_type == AgentType.CHITCHAT:
        async for event in _process_chitchat_stream(query, history):
            yield event
    elif agent_type == AgentType.ANALYSIS:
        async for event in _process_analysis_stream(
            query, datasource_id, db_type, host, port,
            database, username, password, schema_name, context, history
        ):
            yield event
    else:
        # 默认走 Text2SQL
        async for event in _process_text2sql_stream(
            datasource_id, db_type, host, port,
            database, username, password, schema_name, query, context, history
        ):
            yield event


async def _process_chitchat_stream(
    query: str,
    history: list[dict],
) -> AsyncGenerator[dict, None]:
    """处理闲聊问题（流式）"""
    # 发送思考事件
    yield ThinkingEvent(content="正在理解您的问题...").to_dict()

    # 调用闲聊智能体
    response = process_chitchat(query, history=history)

    # 发送消息事件
    yield MessageEvent(content=response).to_dict()

    # 发送完成事件
    yield DoneEvent(message="回复完成").to_dict()


async def _process_analysis_stream(
    query: str,
    datasource_id: str,
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    schema_name: Optional[str],
    context: dict,
    history: list[dict],
) -> AsyncGenerator[dict, None]:
    """处理分析问题（流式）"""
    import time

    # 发送思考事件
    yield ThinkingEvent(content="正在分析您的问题，准备获取相关数据...").to_dict()

    # 获取 Schema
    schema_text = await _get_schema_text(datasource_id)

    # 先执行查询获取数据
    yield ThinkingEvent(content="正在获取相关数据进行分析...").to_dict()

    # 生成 SQL 查询
    sql_result = await _generate_sql_for_analysis(query, schema_text, history)

    analysis_data = None
    if sql_result.get("sql"):
        yield SQLGenerationEvent(sql=sql_result["sql"]).to_dict()

        # 执行 SQL
        start_time = time.time()
        yield SQLExecutionEvent(status="running").to_dict()

        query_result = await db_service.execute_query(
            db_type=db_type, host=host, port=port,
            database=database, username=username, password=password,
            sql=sql_result["sql"],
        )

        duration = time.time() - start_time
        yield SQLExecutionEvent(status="completed", duration=duration).to_dict()

        if query_result["success"]:
            analysis_data = {
                "columns": query_result["columns"],
                "rows": query_result["rows"],
                "total": query_result["total"],
            }

    # 进行分析
    yield ThinkingEvent(content="正在分析数据，生成洞察...").to_dict()

    analysis_result = process_analysis(
        question=query,
        data_context={"result": analysis_data, "sql": sql_result.get("sql")},
        schema_text=schema_text,
        history=history,
    )

    # 发送分析结果
    yield AnalysisEvent(
        insights=[{"title": i.title, "content": i.content, "importance": i.importance}
                  for i in analysis_result.insights],
        recommendations=analysis_result.recommendations,
        summary=analysis_result.summary
    ).to_dict()

    # 发送完成事件
    yield DoneEvent(message="分析完成").to_dict()


async def _process_text2sql_stream(
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
    """处理 Text2SQL 问题（流式）"""
    import time

    # 发送思考事件
    yield ThinkingEvent(content="正在分析您的问题...").to_dict()

    # 获取 Schema
    schema_text = await _get_schema_text(datasource_id)

    yield ThinkingEvent(content="正在探索数据库 Schema...").to_dict()

    # 发送工具调用事件
    tool_id = f"call_{uuid.uuid4().hex[:8]}"
    yield ToolCallEvent(
        tool="explore_schema",
        input={"datasource_id": datasource_id},
        id=tool_id
    ).to_dict()

    # 发送工具结果
    yield ToolResultEvent(
        tool="explore_schema",
        id=tool_id,
        output=f"已加载 {len(schema_text)} 字符的 Schema 信息"
    ).to_dict()

    # 生成 SQL
    yield ThinkingEvent(content="正在生成 SQL 查询...").to_dict()

    # 调用智能体生成 SQL
    result = await process_query(
        datasource_id=datasource_id,
        db_type=db_type, host=host, port=port,
        database=database, username=username, password=password,
        schema_name=schema_name,
        query=query,
        context=context,
        history=history,
    )

    # 发送 SQL 生成事件
    if result.get("sql"):
        yield SQLGenerationEvent(sql=result["sql"]).to_dict()

        # 执行 SQL
        yield SQLExecutionEvent(status="running").to_dict()

        start_time = time.time()
        query_result = await db_service.execute_query(
            db_type=db_type, host=host, port=port,
            database=database, username=username, password=password,
            sql=result["sql"],
        )
        duration = time.time() - start_time

        if query_result["success"]:
            yield SQLExecutionEvent(status="completed", duration=duration).to_dict()

            # 生成可视化建议
            viz_suggestion = _analyze_visualization_intent(
                query, query_result["columns"], query_result["rows"]
            )

            if viz_suggestion:
                yield VisualizationEvent(suggestion=viz_suggestion).to_dict()

            # 发送结果
            yield ResultEvent(
                columns=query_result["columns"],
                rows=query_result["rows"],
                total=query_result["total"],
                truncated=query_result["truncated"]
            ).to_dict()

            # 更新 result
            result["result"] = {
                "columns": query_result["columns"],
                "rows": query_result["rows"],
                "total": query_result["total"],
                "truncated": query_result["truncated"],
            }
        else:
            yield SQLExecutionEvent(status="failed").to_dict()
            yield ErrorEvent(message=query_result.get("error", "SQL 执行失败")).to_dict()
            result["error"] = query_result.get("error")

    # 发送完成事件
    yield DoneEvent(message="查询完成").to_dict()

    # 最终结果作为 data
    yield {"type": "done", "data": result}


async def _generate_sql_for_analysis(query: str, schema_text: str, history: list[dict]) -> dict:
    """为分析生成 SQL 查询"""
    llm = _get_llm()

    system_prompt = f"""你是一个数据分析师助手。用户需要分析数据，请生成一个 SQL 查询来获取相关数据。

{schema_text}

## 规则

- 只生成 SELECT 语句
- 根据分析问题选择合适的表和字段
- 如果需要聚合，使用 GROUP BY
- 如果需要排序，使用 ORDER BY
- 输出 SQL 语句，用 ```sql 包裹

## 示例

问题：分析最近一年的销售趋势
SQL：
```sql
SELECT DATE_FORMAT(order_date, '%Y-%m') as month, SUM(amount) as total_sales
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
GROUP BY DATE_FORMAT(order_date, '%Y-%m')
ORDER BY month
```
"""

    messages = [("system", system_prompt)]
    for msg in history[-5:]:
        messages.append((msg["role"], msg["content"]))
    messages.append(("user", query))

    response = await llm.ainvoke(messages)
    sql = _extract_sql(response.content)

    return {"sql": sql}