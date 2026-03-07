"""分析智能体 - 数据分析和建议"""

from typing import Optional, List
from dataclasses import dataclass
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.core import get_settings

settings = get_settings()


@dataclass
class Insight:
    """洞察"""
    title: str
    content: str
    importance: str  # high/medium/low


@dataclass
class AnalysisResult:
    """分析结果"""
    insights: List[Insight]
    recommendations: List[str]
    summary: str


# 系统提示词
ANALYSIS_SYSTEM_PROMPT = """你是一个专业的数据分析师。你的任务是基于提供的数据进行深入分析，给出有价值的洞察和建议。

## 分析框架

1. **数据概览**：总结数据的基本情况
2. **关键发现**：识别数据中的重要模式和异常
3. **原因分析**：解释数据变化的原因
4. **趋势预测**：基于历史数据预测未来趋势
5. **行动建议**：给出具体的改进建议

## 输出格式

请按以下格式输出：

### 数据概览
[简要描述数据的整体情况]

### 关键发现
1. [发现1]：[描述]
2. [发现2]：[描述]
...

### 原因分析
[分析数据变化的原因]

### 趋势预测
[基于数据预测未来趋势]

### 建议措施
1. [建议1]
2. [建议2]
...

## 注意事项

- 分析要有数据支撑，不要凭空臆测
- 建议要具体可执行
- 如果数据不足，明确指出
- 用专业但易懂的语言表达
"""


def process_analysis(
    question: str,
    data_context: dict = None,
    schema_text: str = None,
    history: list = None,
) -> AnalysisResult:
    """
    处理数据分析问题。

    Args:
        question: 用户问题
        data_context: 数据上下文（包含查询结果等）
        schema_text: Schema 信息
        history: 对话历史

    Returns:
        AnalysisResult: 分析结果
    """
    try:
        llm = ChatOpenAI(
            model=settings.llm_model_name,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            temperature=0.3,
            max_tokens=2000,
        )

        # 构建分析提示
        analysis_prompt = f"用户问题：{question}\n\n"

        if schema_text:
            analysis_prompt += f"## 数据库 Schema\n{schema_text}\n\n"

        if data_context:
            if data_context.get("result"):
                result = data_context["result"]
                analysis_prompt += f"## 相关数据\n"
                analysis_prompt += f"列名：{result.get('columns', [])}\n"
                analysis_prompt += f"数据行数：{result.get('total', 0)}\n"
                if result.get("rows"):
                    # 只展示前20行
                    rows = result["rows"][:20]
                    analysis_prompt += f"数据示例：\n"
                    for row in rows:
                        analysis_prompt += f"{row}\n"

        messages = [
            SystemMessage(content=ANALYSIS_SYSTEM_PROMPT),
            HumanMessage(content=analysis_prompt)
        ]

        response = llm.invoke(messages)
        content = response.content

        # 解析结果
        return _parse_analysis_result(content)

    except Exception as e:
        return AnalysisResult(
            insights=[Insight(
                title="分析错误",
                content=f"无法完成分析: {str(e)}",
                importance="high"
            )],
            recommendations=[],
            summary="分析过程中出现错误，请稍后重试。"
        )


def _parse_analysis_result(content: str) -> AnalysisResult:
    """解析分析结果"""
    insights = []
    recommendations = []

    # 简单解析 - 提取关键发现和建议
    lines = content.split("\n")
    current_section = None

    for line in lines:
        line = line.strip()
        if "关键发现" in line or "发现" in line:
            current_section = "insights"
        elif "建议" in line or "行动" in line:
            current_section = "recommendations"
        elif line.startswith(("-", "1.", "2.", "3.", "4.", "5.")):
            if current_section == "insights":
                insights.append(Insight(
                    title="发现",
                    content=line.lstrip("- 123456789."),
                    importance="medium"
                ))
            elif current_section == "recommendations":
                recommendations.append(line.lstrip("- 123456789."))

    # 如果解析失败，返回原始内容
    if not insights and not recommendations:
        insights.append(Insight(
            title="分析结果",
            content=content[:500] + "..." if len(content) > 500 else content,
            importance="high"
        ))

    # 生成摘要
    summary = content.split("\n\n")[0] if content else "分析完成"

    return AnalysisResult(
        insights=insights,
        recommendations=recommendations,
        summary=summary
    )


def get_analysis_agent():
    """获取分析智能体"""
    return process_analysis