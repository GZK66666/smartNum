"""路由智能体 - 判断用户问题类型"""

from enum import Enum
from typing import Optional
from dataclasses import dataclass
import json
import re

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.core import get_settings

settings = get_settings()


class AgentType(str, Enum):
    """智能体类型"""
    TEXT2SQL = "text2sql"
    CHITCHAT = "chitchat"
    ANALYSIS = "analysis"


@dataclass
class RouteResult:
    """路由结果"""
    agent: AgentType
    confidence: float
    reason: Optional[str] = None


# 问题类型关键词模式
ROUTE_PATTERNS = {
    AgentType.CHITCHAT: [
        # 问候语
        r"你好|您好|hi|hello|hey",
        r"早上好|下午好|晚上好|早安|晚安",
        r"你是谁|你叫什么|自我介绍",
        r"谢谢|感谢|多谢",
        r"再见|拜拜|bye",
        # 闲聊
        r"怎么样|如何呀|最近",
        r"聊.*天|陪我聊",
        r"无聊|有趣",
        r"你 (能|会|懂|知道).* 吗",
    ],
    AgentType.ANALYSIS: [
        # 数据分析
        r"分析|趋势|规律|洞察",
        r"为什么|原因|导致",
        r"建议|推荐|怎么办|如何提升|如何改进",
        r"预测|预估|未来",
        r"对比分析|比较分析",
        r"异常|问题|风险",
    ],
    AgentType.TEXT2SQL: [
        # 数据查询
        r"查询|查一下|查看|显示",
        r"统计|计算|总数|平均|最大|最小|求和",
        r"有多少|几个|多少",
        r"列出|找出|筛选|过滤",
        r"按.*排序|前 \d+|后 \d+|TOP",
        r"销售额|订单|用户|商品|产品",
        r"昨天|今天|明天|上周|下周|本月|上月|今年|去年",
        r"对比.*和.*|比较.*和.*",
    ],
}


def _match_patterns(text: str, patterns: list) -> bool:
    """检查文本是否匹配任一模式"""
    text_lower = text.lower()
    for pattern in patterns:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True
    return False


def _quick_route(question: str) -> Optional[RouteResult]:
    """快速路由 - 基于规则匹配"""
    # 先检查闲聊模式
    if _match_patterns(question, ROUTE_PATTERNS[AgentType.CHITCHAT]):
        # 但如果同时包含查询意图，可能是混合问题
        if _match_patterns(question, ROUTE_PATTERNS[AgentType.TEXT2SQL]):
            # 混合问题优先走 text2sql
            return None
        return RouteResult(
            agent=AgentType.CHITCHAT,
            confidence=0.9,
            reason="匹配闲聊模式"
        )

    # 检查分析意图
    if _match_patterns(question, ROUTE_PATTERNS[AgentType.ANALYSIS]):
        return RouteResult(
            agent=AgentType.ANALYSIS,
            confidence=0.85,
            reason="匹配分析模式"
        )

    # 检查查询意图
    if _match_patterns(question, ROUTE_PATTERNS[AgentType.TEXT2SQL]):
        return RouteResult(
            agent=AgentType.TEXT2SQL,
            confidence=0.9,
            reason="匹配查询模式"
        )

    return None


def route_question(question: str, context: dict = None) -> RouteResult:
    """
    路由用户问题到对应的智能体。

    Args:
        question: 用户问题
        context: 对话上下文

    Returns:
        RouteResult: 路由结果
    """
    # 1. 先尝试规则匹配
    quick_result = _quick_route(question)
    if quick_result and quick_result.confidence >= 0.85:
        return quick_result

    # 2. 使用 LLM 进行智能路由
    try:
        llm = ChatOpenAI(
            model=settings.llm_model_name,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            temperature=0.0,
            max_tokens=100,
        )

        system_prompt = """你是一个问题路由器。分析用户问题，判断应该由哪个智能体处理。

输出格式（JSON）：
{
  "agent": "text2sql|chitchat|analysis",
  "confidence": 0.0-1.0,
  "reason": "简短原因"
}

## 路由规则

1. **text2sql**: 用户需要查询数据库中的数据
   - 包含查询、统计、汇总、排名等关键词
   - 需要从数据库获取具体数据
   - 示例：查询销售额、统计订单数、列出用户信息

2. **chitchat**: 闲聊或问候
   - 问候语、自我介绍、感谢
   - 不需要数据库的简单对话
   - 示例：你好、你是谁、谢谢

3. **analysis**: 数据分析或建议
   - 需要基于已有数据进行分析
   - 需要提供洞察、建议或预测
   - 示例：分析销售趋势、为什么下降、如何提升

## 注意事项

- 如果不确定，默认路由到 text2sql
- 简单的问候直接路由到 chitchat
- 包含"分析"、"建议"、"为什么"的分析类问题路由到 analysis

只输出 JSON，不要有其他内容。"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=question)
        ]

        response = llm.invoke(messages)
        content = response.content.strip()

        # 尝试解析 JSON
        # 去除可能的 markdown 代码块标记
        if content.startswith("```"):
            content = re.sub(r"```\w*\n?", "", content)
            content = content.strip("` \n")

        result_data = json.loads(content)

        return RouteResult(
            agent=AgentType(result_data.get("agent", "text2sql")),
            confidence=result_data.get("confidence", 0.5),
            reason=result_data.get("reason")
        )

    except Exception as e:
        # LLM 路由失败，默认走 text2sql
        return RouteResult(
            agent=AgentType.TEXT2SQL,
            confidence=0.5,
            reason=f"LLM路由失败，默认路由: {str(e)}"
        )


def get_router_agent():
    """获取路由智能体（兼容 DeepAgents 框架）"""
    return route_question