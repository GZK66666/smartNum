"""RAGFLOW 知识库管理路由"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File
from pydantic import BaseModel, Field
from typing import List

from app.services.ragflow_service import get_ragflow_service

router = APIRouter(prefix="/api/ragflow", tags=["RAGFLOW 知识库管理"])


# ==================== 响应模型 ====================

class RagflowDocumentResponse(BaseModel):
    """RAGFLOW 文档响应"""
    id: str
    name: str
    type: str
    size: int
    chunk_count: int
    status: str  # parsing, ready, failed
    progress: float
    created_at: str


class RagflowFileListResponse(BaseModel):
    """文件列表响应"""
    documents: List[RagflowDocumentResponse]


# ==================== API 接口 ====================

@router.get("/files", response_model=dict)
async def list_files():
    """获取 RAGFLOW 知识库文件列表"""
    service = get_ragflow_service()
    result = await service.list_files()

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": result.get("error", "获取文件列表失败")},
        )

    return {"code": 0, "data": result.get("documents", [])}


@router.post("/files/upload", response_model=dict)
async def upload_file(file: UploadFile = File(...)):
    """上传文件到 RAGFLOW 知识库"""
    # 验证文件大小 (最大 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "文件大小不能超过 10MB"},
        )

    service = get_ragflow_service()
    result = await service.upload_file(
        file_content=file_content,
        filename=file.filename or "unknown",
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": result.get("error", "上传失败")},
        )

    return {"code": 0, "data": result.get("data", {})}


@router.get("/files/{doc_id}", response_model=dict)
async def get_file_status(doc_id: str):
    """获取文件解析状态和进度"""
    service = get_ragflow_service()
    result = await service.get_file_status(doc_id)

    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "文件不存在"},
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": result.get("error", "获取状态失败")},
        )

    return {"code": 0, "data": result.get("data", {})}


@router.delete("/files/{doc_id}", response_model=dict)
async def delete_file(doc_id: str):
    """删除 RAGFLOW 知识库文件"""
    service = get_ragflow_service()
    result = await service.delete_file(doc_id)

    if not result.get("success"):
        if "not found" in result.get("error", "").lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "文件不存在"},
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": result.get("error", "删除失败")},
        )

    return {"code": 0, "message": "文件已删除"}


@router.post("/files/parse", response_model=dict)
async def parse_files(doc_ids: List[str] = Field(..., description="文档 ID 列表")):
    """触发文件解析"""
    service = get_ragflow_service()
    result = await service.parse_file(doc_ids)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": result.get("error", "解析失败")},
        )

    return {"code": 0, "message": "解析任务已启动"}
