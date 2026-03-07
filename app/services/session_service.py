"""会话服务"""

import json
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

from app.models import SessionResponse, MessageResponse, MessageHistory, QueryResult
from app.services import datasource_service, agent_service

# 内存存储
_sessions: dict[str, dict] = {}


async def create_session(datasource_id: str) -> SessionResponse:
    """创建会话"""
    # 检查数据源是否存在
    ds = await datasource_service.get_datasource(datasource_id)
    if ds is None:
        raise ValueError(f"数据源不存在: {datasource_id}")

    # 生成会话 ID
    session_id = f"sess_{uuid.uuid4().hex[:12]}"

    # 存储会话
    _sessions[session_id] = {
        "datasource_id": datasource_id,
        "messages": [],
        "context": {},
        "created_at": datetime.utcnow(),
        "last_active_at": datetime.utcnow(),
    }

    return SessionResponse(
        session_id=session_id,
        datasource_id=datasource_id,
        created_at=_sessions[session_id]["created_at"],
    )


async def delete_session(session_id: str) -> bool:
    """删除会话"""
    if session_id in _sessions:
        del _sessions[session_id]
        return True
    return False


async def get_session(session_id: str) -> Optional[dict]:
    """获取会话"""
    return _sessions.get(session_id)


async def send_message(session_id: str, content: str) -> Optional[MessageResponse]:
    """发送消息（非流式）"""
    session = _sessions.get(session_id)
    if session is None:
        return None

    # 获取数据源
    datasource_id = session["datasource_id"]
    ds = await datasource_service.get_datasource(datasource_id)
    if ds is None:
        return None

    # 添加用户消息
    user_msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    user_msg = {
        "id": user_msg_id,
        "role": "user",
        "content": content,
        "created_at": datetime.utcnow(),
    }
    session["messages"].append(user_msg)

    # 调用智能体处理
    result = await agent_service.process_query(
        datasource_id=datasource_id,
        db_type=ds["type"].value,
        host=ds["host"],
        port=ds["port"],
        database=ds["database"],
        username=ds["username"],
        password=ds["password"],
        schema_name=ds.get("schema_name"),
        query=content,
        context=session["context"],
        history=session["messages"][:-1],  # 不包含刚添加的消息
    )

    # 添加助手消息
    assistant_msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    assistant_msg = {
        "id": assistant_msg_id,
        "role": "assistant",
        "content": result.get("content", ""),
        "sql": result.get("sql"),
        "result": result.get("result"),
        "error": result.get("error"),
        "created_at": datetime.utcnow(),
    }
    session["messages"].append(assistant_msg)

    # 更新上下文
    if result.get("sql"):
        session["context"]["last_sql"] = result["sql"]

    # 更新最后活跃时间
    session["last_active_at"] = datetime.utcnow()

    return MessageResponse(
        id=assistant_msg_id,
        role="assistant",
        content=assistant_msg["content"],
        sql=assistant_msg.get("sql"),
        result=QueryResult(**assistant_msg["result"]) if assistant_msg.get("result") else None,
        error=assistant_msg.get("error"),
        created_at=assistant_msg["created_at"],
    )


async def send_message_stream(session_id: str, content: str) -> AsyncGenerator[str, None]:
    """发送消息（流式 SSE）"""
    session = _sessions.get(session_id)
    if session is None:
        raise ValueError(f"会话不存在: {session_id}")

    # 获取数据源
    datasource_id = session["datasource_id"]
    ds = await datasource_service.get_datasource(datasource_id)
    if ds is None:
        raise ValueError(f"数据源不存在: {datasource_id}")

    # 添加用户消息
    user_msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    user_msg = {
        "id": user_msg_id,
        "role": "user",
        "content": content,
        "created_at": datetime.utcnow(),
    }
    session["messages"].append(user_msg)

    # 流式处理
    result = None
    async for event in agent_service.process_query_stream(
        datasource_id=datasource_id,
        db_type=ds["type"].value,
        host=ds["host"],
        port=ds["port"],
        database=ds["database"],
        username=ds["username"],
        password=ds["password"],
        schema_name=ds.get("schema_name"),
        query=content,
        context=session["context"],
        history=session["messages"][:-1],
    ):
        # 记录最终结果
        if event.get("type") == "done":
            result = event.get("data")

        # 发送 SSE 事件 (使用 JSON 序列化)
        yield f"event: {event.get('type', 'message')}\n"
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    # 添加助手消息
    if result:
        assistant_msg_id = f"msg_{uuid.uuid4().hex[:8]}"
        assistant_msg = {
            "id": assistant_msg_id,
            "role": "assistant",
            "content": result.get("content", ""),
            "sql": result.get("sql"),
            "result": result.get("result"),
            "error": result.get("error"),
            "created_at": datetime.utcnow(),
        }
        session["messages"].append(assistant_msg)

        if result.get("sql"):
            session["context"]["last_sql"] = result["sql"]

    session["last_active_at"] = datetime.utcnow()


async def get_message_history(session_id: str, limit: int = 20) -> Optional[MessageHistory]:
    """获取消息历史"""
    session = _sessions.get(session_id)
    if session is None:
        return None

    messages = session["messages"][-limit:]
    message_responses = []

    for msg in messages:
        message_responses.append(MessageResponse(
            id=msg["id"],
            role=msg["role"],
            content=msg["content"],
            sql=msg.get("sql"),
            result=QueryResult(**msg["result"]) if msg.get("result") else None,
            error=msg.get("error"),
            created_at=msg["created_at"],
        ))

    return MessageHistory(
        session_id=session_id,
        messages=message_responses,
    )