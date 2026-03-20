"""RAGFLOW 知识库管理路由"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Body
from pydantic import BaseModel, Field
from typing import List, Optional

from app.services.ragflow_service import get_ragflow_service

router = APIRouter(prefix="/api/ragflow", tags=["RAGFLOW 知识库管理"])


# ==================== 响应模型 ====================

class RagflowDocumentResponse(BaseModel):
    """RAGFLOW 文档响应"""
    id: str
    name: str
    type: str  # pdf, docx, md, txt 等
    size: int
    chunk_count: int
    status: str  # parsing, ready, failed
    progress: float  # 0-1 之间
    created_at: str


# ==================== 辅助函数 ====================

def map_to_document(doc: dict) -> dict:
    """
    将 RAGFLOW API 返回的文档格式映射到前端期望的格式

    RAGFLOW 返回:
    - chunk_count, create_date, type, run (UNSTART/RUNNING/DONE/FAIL),
      size, name, progress (0-100), id, thumbnail, parser_config 等

    前端期望:
    - id, name, type, size, chunk_count, status (pending/parsing/ready/failed),
      progress (0-1), created_at
    """
    # 映射状态：UNSTART->pending, RUNNING->parsing, DONE->ready, FAIL->failed
    run_status = doc.get("run", "UNSTART")
    if run_status == "UNSTART":
        status = "pending"  # 等待解析
    elif run_status == "RUNNING":
        status = "parsing"
    elif run_status == "DONE":
        status = "ready"
    elif run_status == "FAIL":
        status = "failed"
    else:
        status = "pending"

    # progress 在 RAGFLOW 中是 0-100，前端期望 0-1
    progress = doc.get("progress", 0)
    if progress > 1:
        progress = progress / 100.0

    # 获取文件类型（从 name 或 type 字段）
    file_type = doc.get("type", "")
    if not file_type and doc.get("location"):
        file_type = doc["location"].split(".")[-1] if "." in doc["location"] else "unknown"

    return {
        "id": doc.get("id", ""),
        "name": doc.get("name", ""),
        "type": file_type,
        "size": doc.get("size", 0),
        "chunk_count": doc.get("chunk_count", 0),
        "status": status,
        "progress": progress,
        "created_at": doc.get("create_date") or doc.get("create_time", ""),
    }


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

    # 映射字段格式
    docs = result.get("documents", [])
    mapped_docs = [map_to_document(doc) for doc in docs]

    return {"code": 0, "data": mapped_docs}


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

    # 返回上传结果，包含 doc_id, name, status
    return {"code": 0, "data": result}


@router.get("/files/{doc_id}", response_model=dict)
async def get_file_status(doc_id: str):
    """获取文件解析状态和进度"""
    service = get_ragflow_service()
    result = await service.get_file_status(doc_id)

    if not result.get("success"):
        if "not found" in result.get("error", "").lower() or "不存在" in result.get("error", ""):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "文件不存在"},
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": result.get("error", "获取状态失败")},
        )

    # 映射字段格式
    doc_data = result.get("data", {})
    mapped_doc = map_to_document({
        "id": doc_data.get("doc_id"),
        "name": doc_data.get("name"),
        "run": doc_data.get("status"),
        "progress": doc_data.get("progress", 0) * 100,  # 转回 0-100 格式给 map_to_document
        "chunk_count": doc_data.get("chunk_count", 0),
        "size": 0,  # get_file_status 不返回 size
        "create_date": doc_data.get("created_at"),
        "type": "",
    })

    return {"code": 0, "data": mapped_doc}


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
async def parse_files(doc_ids: List[str] = Body(..., description="文档 ID 列表")):
    """触发文件解析"""
    service = get_ragflow_service()
    result = await service.parse_file(doc_ids)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": result.get("error", "解析失败")},
        )

    return {"code": 0, "message": "解析任务已启动"}
