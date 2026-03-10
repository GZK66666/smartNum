"""会话管理路由"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse, Response
from app.models import (
    ApiResponse,
    SessionCreate,
    SessionResponse,
    MessageCreate,
    MessageHistory,
    ErrorCode,
    ExportRequest,
)
from app.services import session_service
from app.services.export_service import export_data
from app.services.agent_service import get_export_file

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
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
            },
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


@router.get("/export/{download_id}")
async def download_export_file(download_id: str):
    """
    下载导出的文件

    根据 download_id 下载导出的 CSV 或 Excel 文件。
    """
    import urllib.parse

    file_info = get_export_file(download_id)

    if file_info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.EXPORT_DATA_NOT_FOUND,
                "message": "文件不存在或已过期",
            },
        )

    # 处理中文文件名：使用 RFC 5987 编码
    filename = file_info["filename"]
    encoded_filename = urllib.parse.quote(filename, encoding='utf-8')

    return Response(
        content=file_info["content"],
        media_type=file_info["mime_type"],
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )


@router.post("/{session_id}/export")
async def export_session_result(
    session_id: str,
    data: ExportRequest,
):
    """
    导出最近查询结果

    将最近一次查询的结果导出为 CSV 或 Excel 格式。
    """
    # 获取会话
    session = await session_service.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.SESSION_NOT_FOUND,
                "message": "会话不存在",
            },
        )

    # 获取最近的有结果的消息
    result_data = None
    for msg in reversed(session.get("messages", [])):
        if msg.get("role") == "assistant" and msg.get("result"):
            result_data = msg["result"]
            break

    if result_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.EXPORT_DATA_NOT_FOUND,
                "message": "没有可导出的数据",
            },
        )

    # 执行导出
    try:
        columns = result_data.get("columns", [])
        rows = result_data.get("rows", [])

        content, filename, mime_type = export_data(
            columns=columns,
            rows=rows,
            format=data.format,
            filename=data.filename,
        )

        return Response(
            content=content,
            media_type=mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCode.EXPORT_DATA_TOO_LARGE,
                "message": str(e),
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.EXPORT_DATA_NOT_FOUND,
                "message": f"导出失败: {str(e)}",
            },
        )