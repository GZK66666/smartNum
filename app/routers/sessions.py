"""会话管理路由"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from app.models import (
    ApiResponse,
    SessionCreate,
    SessionResponse,
    MessageCreate,
    MessageHistory,
    ErrorCode,
)
from app.services import session_service

router = APIRouter(prefix="/api/sessions", tags=["会话管理"])


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_session(data: SessionCreate):
    """创建会话"""
    try:
        session = await session_service.create_session(data.datasource_id)
        return ApiResponse(data=session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": str(e),
            },
        )


@router.delete("/{session_id}", response_model=ApiResponse)
async def delete_session(session_id: str):
    """删除会话"""
    success = await session_service.delete_session(session_id)
    if success:
        return ApiResponse(message="会话已删除")
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )


@router.post("/{session_id}/messages", response_model=ApiResponse)
async def send_message(session_id: str, data: MessageCreate):
    """发送消息（非流式）"""
    try:
        response = await session_service.send_message(session_id, data.content)
        if response is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": ErrorCode.SESSION_NOT_FOUND,
                    "message": "会话不存在",
                },
            )
        return ApiResponse(data=response)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.SQL_GENERATION_FAILED,
                "message": f"处理消息失败: {str(e)}",
            },
        )


@router.post("/{session_id}/messages/stream")
async def send_message_stream(session_id: str, data: MessageCreate):
    """发送消息（流式 SSE）"""
    try:
        return StreamingResponse(
            session_service.send_message_stream(session_id, data.content),
            media_type="text/event-stream",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": str(e),
            },
        )


@router.get("/{session_id}/messages", response_model=ApiResponse)
async def get_messages(session_id: str, limit: int = 20):
    """获取对话历史"""
    history = await session_service.get_message_history(session_id, limit)
    if history is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )
    return ApiResponse(data=history)