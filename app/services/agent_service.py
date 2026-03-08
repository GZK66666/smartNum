"""DeepAgents 统一智能体服务 - v2.0 架构

核心设计原则：
- 单一 DeepAgent 处理所有用户请求
- 充分利用 DeepAgents 的 loop 能力
- Agent 自主决定使用哪些工具
- SSE 流式输出适配
"""

import json
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

SYSTEM_PROMPT = """你是 smartNum 智能数据分析助手，一个专业、全能的数据分析专家。

## 你的能力

1. **数据查询**：帮助用户用自然语言查询数据库
2. **数据分析**：提供数据洞察、趋势分析、异常检测
3. **数据可视化**：自动生成图表展示数据
4. **智能对话**：友好地回答用户问题

## 工作原则

### 数据查询
- 首先使用 get_schema 了解数据库结构
- 根据用户问题生成正确的 SQL
- 使用 run_sql 执行查询
- 解释查询结果，突出关键信息

### 数据分析
- 基于查询结果进行深入分析
- 识别数据中的模式、趋势和异常
- 提供有价值的洞察和建议
- 使用具体数据支撑分析结论

### 数据可视化
- 根据数据特征和用户意图选择合适的图表类型
- 折线图：展示趋势变化
- 柱状图：对比分析
- 饼图：占比分析
- 散点图：关联分析

### 对话交互
- 简洁友好，不过度啰嗦
- 主动引导用户使用你的核心能力
- 用中文回复

## 安全规则

- 只执行 SELECT 查询，禁止 DELETE/UPDATE/INSERT
- 不查询敏感表（如密码表）
- 不暴露敏感数据（如手机号、身份证）
- 大结果集提示用户添加筛选条件

## 决策流程

1. 分析用户问题的意图（查询/分析/闲聊）
2. 根据意图选择合适的工具和策略
3. 执行操作并获取结果
4. 综合分析并生成回答
5. 如果需要，继续迭代直到任务完成
"""


# ==================== 核心工具定义 ====================

def get_schema(
    datasource_id: str,
    table_pattern: Optional[str] = None,
) -> str:
    """
    获取数据库 Schema 信息。

    Args:
        datasource_id: 数据源ID
        table_pattern: 表名匹配模式（支持通配符 %），可选

    Returns:
        数据库表结构信息（Markdown格式）
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

            # 表名过滤
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

    # 运行异步函数
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
    执行 SQL 查询并返回结果。

    Args:
        datasource_id: 数据源ID
        sql: SQL 查询语句（仅支持 SELECT）
        limit: 最大返回行数，默认 1000

    Returns:
        查询结果，包含 columns, rows, total, truncated 字段
    """

    async def _execute():
        from app.services import datasource_service, db_service
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


def generate_chart(
    data: dict,
    chart_type: str = "auto",
    title: str = "",
) -> dict:
    """
    根据数据生成图表配置。

    Args:
        data: 查询结果数据，包含 columns 和 rows
        chart_type: 图表类型 (line/bar/pie/scatter/auto)，默认自动推断
        title: 图表标题，可选

    Returns:
        ECharts 图表配置
    """
    columns = data.get("columns", [])
    rows = data.get("rows", [])

    if not columns or not rows:
        return {"error": "数据为空，无法生成图表"}

    # 自动推断图表类型
    if chart_type == "auto":
        chart_type = _infer_chart_type(columns, rows)

    # 生成 ECharts 配置
    option = _generate_echarts_option(columns, rows, chart_type, title)

    return {
        "success": True,
        "chart_type": chart_type,
        "option": option,
    }


def _infer_chart_type(columns: List[str], rows: List[List[Any]]) -> str:
    """推断图表类型"""
    # 时间列检测
    time_keywords = ["date", "time", "日期", "时间", "year", "month", "day"]
    has_time_col = any(kw in col.lower() for col in columns for kw in time_keywords)

    # 数值列检测
    numeric_cols = []
    for i, col in enumerate(columns):
        if rows and isinstance(rows[0][i], (int, float)):
            numeric_cols.append(col)

    if has_time_col and numeric_cols:
        return "line"
    elif len(columns) == 2 and numeric_cols:
        return "bar"
    elif len(numeric_cols) >= 2:
        return "scatter"
    else:
        return "bar"


def _generate_echarts_option(
    columns: List[str],
    rows: List[List[Any]],
    chart_type: str,
    title: str,
) -> dict:
    """生成 ECharts 配置"""

    # 提取 X 轴数据
    x_data = [str(row[0]) for row in rows]

    # 提取 Y 轴数据
    y_data = []
    for i, col in enumerate(columns[1:], 1):
        y_data.append({
            "name": col,
            "type": chart_type if chart_type != "scatter" else "scatter",
            "data": [row[i] for row in rows]
        })

    option = {
        "title": {
            "text": title or "数据图表"
        },
        "tooltip": {
            "trigger": "axis" if chart_type in ["line", "bar"] else "item"
        },
        "legend": {
            "data": [col for col in columns[1:]]
        },
        "xAxis": {
            "type": "category",
            "data": x_data
        },
        "yAxis": {
            "type": "value"
        },
        "series": y_data
    }

    return option


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

    # 创建智能体
    _agent = create_deep_agent(
        name="smartnum-agent",
        model=llm,
        tools=[get_schema, run_sql, generate_chart],
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
    """流式处理用户查询 - v2.0 统一架构"""

    # 发送思考事件
    yield ThinkingEvent(content="正在分析您的问题...").to_dict()

    # 使用 DeepAgent 流式处理
    agent = get_agent()

    # 使用唯一的 thread_id 确保每次调用独立
    # 注意：不使用 checkpointer，所以每次调用是无状态的
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    # 构建消息 - 包含历史对话以保持上下文
    # 但要确保格式正确：只包含 role 和 content
    messages = []
    for msg in history[-10:]:
        # 只提取 role 和 content，确保格式干净
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if content:  # 只添加有内容的消息
            messages.append({"role": role, "content": content})

    # 添加当前问题
    messages.append({"role": "user", "content": f"[数据源ID: {datasource_id}] {query}"})

    try:
        # 用于收集最终结果
        final_result = {
            "content": "",
            "sql": None,
            "result": None,
            "error": None,
        }

        # 流式调用，传入 config 确保每次调用是独立的
        for chunk in agent.stream({"messages": messages}, config=config):
            # 调试：打印 chunk 结构
            print(f"[DEBUG] chunk type: {type(chunk)}")
            print(f"[DEBUG] chunk: {chunk}")

            # 解析 chunk
            event = _parse_agent_chunk(chunk)

            if event:
                # 收集消息内容
                if isinstance(event, MessageEvent) and event.content:
                    final_result["content"] = event.content

                # 特殊处理 SQL 相关事件
                if isinstance(event, ToolCallEvent) and event.tool == "run_sql":
                    sql = event.input.get("sql", "") if event.input else ""
                    if sql:
                        final_result["sql"] = sql
                        yield SQLGenerationEvent(sql=sql).to_dict()
                        yield SQLExecutionEvent(status="running").to_dict()

                if isinstance(event, ToolResultEvent) and event.tool == "run_sql":
                    yield SQLExecutionEvent(status="completed").to_dict()

                    # 尝试解析结果并生成可视化
                    try:
                        result_data = json.loads(event.output) if event.output else {}
                        if result_data.get("success"):
                            final_result["result"] = {
                                "columns": result_data.get("columns", []),
                                "rows": result_data.get("rows", []),
                                "total": result_data.get("total", 0),
                                "truncated": result_data.get("truncated", False),
                            }
                            yield ResultEvent(
                                columns=result_data.get("columns", []),
                                rows=result_data.get("rows", []),
                                total=result_data.get("total", 0),
                                truncated=result_data.get("truncated", False)
                            ).to_dict()

                            # 生成可视化建议
                            viz = _generate_visualization_suggestion(
                                result_data.get("columns", []),
                                result_data.get("rows", []),
                                query
                            )
                            if viz:
                                yield VisualizationEvent(suggestion=viz).to_dict()
                    except:
                        pass

                yield event.to_dict()

        # 发送完成事件，包含最终结果
        yield {"type": "done", "message": "处理完成", "data": final_result}

    except Exception as e:
        yield ErrorEvent(message=f"处理出错: {str(e)}").to_dict()
        yield DoneEvent(message="处理结束").to_dict()


def _parse_agent_chunk(chunk: dict) -> Optional[SSEEvent]:
    """解析 Agent 输出的 chunk，转换为 SSE 事件"""

    # DeepAgents 的 chunk 是嵌套结构，需要遍历查找 messages
    for key, value in chunk.items():
        if isinstance(value, dict) and "messages" in value:
            messages = value["messages"]

            # 处理 LangGraph 的 Overwrite 对象
            if hasattr(messages, "value"):
                messages = messages.value
            elif not isinstance(messages, (list, tuple)):
                # 尝试转换为列表
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
                        # 有工具调用，返回工具调用事件
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

                    # 普通 AI 消息，有内容才返回
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

                    if msg_content and isinstance(msg_content, str) and msg_content.strip():
                        return MessageEvent(content=msg_content)

    # 处理 todos 事件
    if "todos" in chunk:
        return PlanEvent(todos=chunk["todos"])

    return None


def _generate_visualization_suggestion(
    columns: List[str],
    rows: List[List[Any]],
    question: str,
) -> Optional[dict]:
    """生成可视化建议"""
    if not columns or not rows:
        return None

    question_lower = question.lower()

    # 检测图表类型意图
    chart_type = None
    confidence = 0.5

    if any(word in question_lower for word in ["趋势", "变化", "走势", "增长", "下降"]):
        chart_type = "line"
        confidence = 0.85
    elif any(word in question_lower for word in ["对比", "比较", "各", "每个"]):
        chart_type = "bar"
        confidence = 0.85
    elif any(word in question_lower for word in ["占比", "比例", "百分比"]):
        chart_type = "pie"
        confidence = 0.85
    elif any(word in question_lower for word in ["前", "排名", "最多", "最少", "top"]):
        chart_type = "bar"
        confidence = 0.8

    # 基于数据特征推断
    if chart_type is None:
        time_keywords = ["date", "time", "日期", "时间", "year", "month", "day"]
        has_time_col = any(kw in col.lower() for col in columns for kw in time_keywords)

        numeric_cols = []
        for i, col in enumerate(columns):
            if rows and isinstance(rows[0][i], (int, float)):
                numeric_cols.append(col)

        if has_time_col and numeric_cols:
            chart_type = "line"
            confidence = 0.75
        elif len(columns) == 2 and numeric_cols:
            chart_type = "bar"
            confidence = 0.7
        else:
            return None

    return {
        "chart_type": chart_type,
        "title": question[:30] + "..." if len(question) > 30 else question,
        "confidence": confidence,
        "x_axis": {"field": columns[0], "label": columns[0]},
        "y_axis": {"field": columns[1] if len(columns) > 1 else columns[0], "label": columns[1] if len(columns) > 1 else columns[0]}
    }


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
        elif event.get("type") == "result":
            if result is None:
                result = {}
            result["result"] = {
                "columns": event.get("columns"),
                "rows": event.get("rows"),
                "total": event.get("total"),
                "truncated": event.get("truncated"),
            }

    return result or {"content": "处理完成", "error": None}