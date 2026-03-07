"""智能体模块 - v1.1 泛化智能体架构"""

from app.agents.router_agent import route_question, get_router_agent
from app.agents.chitchat_agent import get_chitchat_agent
from app.agents.analysis_agent import get_analysis_agent

__all__ = [
    "route_question",
    "get_router_agent",
    "get_chitchat_agent",
    "get_analysis_agent",
]