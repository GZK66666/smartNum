"""会话管理路由 - V3.0 持久化版本"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional

from app.models.database import get_db
from app.routers.auth import get_current_user_id
from app.services.session_service import SessionService
from app.services.datasource_service import DataSourceService
from app.models import ErrorCode

router = APIRouter(prefix="/api/sessions", tags=["会话管理"])


# ==================== 请求模型 ====================

class SessionCreateRequest(BaseModel):
    """创建会话请求"""
    datasource_id: str = Field(..., description="数据源 ID")


class MessageCreateRequest(BaseModel):
    """发送消息请求"""
    content: str = Field(..., min_length=1, max_length=10000, description="消息内容")


class ExportRequest(BaseModel):
    """导出请求"""
    format: str = Field("csv", description="导出格式：csv/excel")
    filename: Optional[str] = Field(None, description="文件名（不含扩展名）")


# ==================== API 接口 ====================

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: SessionCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """创建会话"""
    session_service = SessionService(db, user_id)

    try:
        session = await session_service.create_session(request.datasource_id)

        return {
            "code": 0,
            "data": {
                "session_id": session.id,
                "datasource_id": session.datasource_id,
                "created_at": session.created_at.isoformat() if session.created_at else None,
            },
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": str(e),
            },
        )


@router.delete("/{session_id}", response_model=dict)
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """删除会话"""
    session_service = SessionService(db, user_id)
    success = await session_service.delete_session(session_id)

    if success:
        return {"code": 0, "message": "会话已删除"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )


@router.get("/{session_id}/messages", response_model=dict)
async def get_messages(
    session_id: str,
    limit: int = Query(20, ge=1, le=100, description="获取消息数量"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """获取消息历史"""
    session_service = SessionService(db, user_id)

    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )

    messages = await session_service.get_message_history(session_id, limit)

    result = []
    for msg in messages:
        msg_dict = {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "sql": msg.sql,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        }
        if msg.result:
            try:
                import json
                msg_dict["result"] = json.loads(msg.result)
            except:
                pass
        result.append(msg_dict)

    return {
        "code": 0,
        "data": {
            "session_id": session_id,
            "messages": result,
        },
    }


@router.post("/{session_id}/messages", response_model=dict)
async def send_message(
    session_id: str,
    request: MessageCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """发送消息（非流式）"""
    session_service = SessionService(db, user_id)
    datasource_service = DataSourceService(db, user_id)

    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )

    datasource = await datasource_service.get_datasource(session.datasource_id)
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "数据源不存在",
            },
        )

    # 使用流式接口但不返回流
    result_content = ""
    result_sql = None
    result_error = None

    async for sse_message in session_service.send_message_stream(
        session_id=session_id,
        content=request.content,
        datasource=datasource,
    ):
        # 解析 SSE 消息
        pass  # 非流式接口不需要处理

    # 获取最后一条助手消息
    messages = await session_service.get_message_history(session_id, limit=1)
    if messages and messages[0].role == "assistant":
        last_msg = messages[0]
        result_content = last_msg.content
        result_sql = last_msg.sql

    return {
        "code": 0,
        "data": {
            "message_id": messages[0].id if messages else None,
            "role": "assistant",
            "content": result_content,
            "sql": result_sql,
            "error": result_error,
        },
    }


@router.post("/{session_id}/messages/stream")
async def send_message_stream(
    session_id: str,
    request: MessageCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """发送消息（流式 SSE）

    注意：流式处理需要使用独立的数据库会话，避免依赖注入的会话过早关闭。
    这里先验证会话和数据源存在，然后使用 SessionService.stream_with_own_db 进行流式处理。
    """
    # 使用依赖注入的数据库会话进行验证
    session_service = SessionService(db, user_id)
    datasource_service = DataSourceService(db, user_id)

    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )

    datasource = await datasource_service.get_datasource(session.datasource_id)
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "数据源不存在",
            },
        )

    # 使用独立的数据库会话进行流式处理
    # 这样可以避免依赖注入的数据库会话在路由函数返回时被关闭
    return StreamingResponse(
        SessionService.stream_with_own_db(
            user_id=user_id,
            session_id=session_id,
            content=request.content,
            datasource=datasource,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/{session_id}/messages", response_model=dict)
async def clear_messages(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """清空会话消息"""
    session_service = SessionService(db, user_id)

    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )

    # 删除该会话的所有消息
    from app.models.models import Message
    from sqlalchemy import delete
    await db.execute(delete(Message).where(Message.session_id == session_id))
    await db.commit()

    return {"code": 0, "message": "消息已清空"}


@router.get("/export/{download_id}")
async def download_export_file(download_id: str):
    """下载导出文件"""
    from app.services.agent_service import get_export_file

    file_info = get_export_file(download_id)
    if file_info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.EXPORT_DATA_NOT_FOUND,
                "message": "文件不存在或已过期",
            },
        )

    from fastapi.responses import Response
    import urllib.parse

    encoded_filename = urllib.parse.quote(file_info["filename"], encoding='utf-8')

    return Response(
        content=file_info["content"],
        media_type=file_info["mime_type"],
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        },
    )
