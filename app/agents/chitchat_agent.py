"""闲聊智能体 - 处理问候和闲聊"""

from typing import Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.core import get_settings

settings = get_settings()


# 系统提示词
CHITCHAT_SYSTEM_PROMPT = """你是 smartNum 智能问数助手，一个专业、友好的数据分析助手。

## 你的能力

1. **数据查询**：帮助用户用自然语言查询数据库
2. **数据分析**：提供数据洞察和分析
3. **数据可视化**：自动生成图表展示数据

## 回复原则

- 简洁友好，不过度啰嗦
- 主动引导用户使用你的核心能力
- 用中文回复
- 如果用户问的是数据相关问题，引导他们描述查询需求

## 示例回复

用户：你好
助手：你好！我是 smartNum 智能问数助手。我可以帮你查询数据库中的数据，只需要用自然语言描述你想了解的信息即可。比如你可以问我："查询上个月的销售额"或"统计各地区的订单数量"。有什么我可以帮你的吗？

用户：你是谁
助手：我是 smartNum 智能问数助手，专门帮助用户通过自然语言查询和分析数据库。你可以直接告诉我你想了解什么数据，我会帮你生成查询并展示结果。

用户：谢谢
助手：不客气！如果还有其他数据问题，随时可以问我。
"""


def process_chitchat(
    question: str,
    context: dict = None,
    history: list = None,
) -> str:
    """
    处理闲聊问题。

    Args:
        question: 用户问题
        context: 对话上下文
        history: 对话历史

    Returns:
        回复内容
    """
    try:
        llm = ChatOpenAI(
            model=settings.llm_model_name,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            temperature=0.7,  # 闲聊使用较高温度
            max_tokens=500,
        )

        messages = [SystemMessage(content=CHITCHAT_SYSTEM_PROMPT)]

        # 添加对话历史
        if history:
            for msg in history[-5:]:  # 最近5条
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("role") == "assistant":
                    messages.append(SystemMessage(content=f"助手：{msg.get('content', '')}"))

        # 添加当前问题
        messages.append(HumanMessage(content=question))

        response = llm.invoke(messages)
        return response.content

    except Exception as e:
        # LLM 调用失败，使用预设回复
        return _get_fallback_response(question)


def _get_fallback_response(question: str) -> str:
    """获取兜底回复"""
    question_lower = question.lower()

    # 问候类
    if any(word in question_lower for word in ["你好", "您好", "hi", "hello"]):
        return "你好！我是 smartNum 智能问数助手。我可以帮你查询数据库中的数据，有什么可以帮你的吗？"

    if any(word in question_lower for word in ["你是谁", "自我介绍"]):
        return "我是 smartNum 智能问数助手，专门帮助用户通过自然语言查询和分析数据库。"

    if any(word in question_lower for word in ["谢谢", "感谢"]):
        return "不客气！如果还有其他问题，随时可以问我。"

    if any(word in question_lower for word in ["再见", "bye"]):
        return "再见！有数据问题随时来找我。"

    # 默认回复
    return '我是一个智能问数助手，可以帮你查询和分析数据库中的数据。你可以直接用自然语言描述你想了解的信息，比如"查询上个月的销售额"。'


def get_chitchat_agent():
    """获取闲聊智能体"""
    return process_chitchat