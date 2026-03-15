"""知识库管理路由 - V3.0 版本"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List

from app.models.database import get_db
from app.routers.auth import get_current_user_id
from app.services.knowledge_service import KnowledgeService
from app.models import ErrorCode

router = APIRouter(prefix="/api/knowledge", tags=["知识库管理"])


# ==================== 请求/响应模型 ====================

class KnowledgeFileUploadRequest(BaseModel):
    """知识文件上传请求（元数据）"""
    datasource_id: Optional[str] = Field(None, description="数据源ID（为空表示全局知识）")
    category: str = Field("raw", description="类别: raw/curated")
    sub_category: Optional[str] = Field(None, description="子类别: indicators/rules/datasets/glossary")
    title: Optional[str] = Field(None, description="标题")
    description: Optional[str] = Field(None, description="描述")
    tags: Optional[List[str]] = Field(None, description="标签列表")


class KnowledgeFileResponse(BaseModel):
    """知识文件响应"""
    id: str
    datasource_id: Optional[str]
    filename: str
    file_type: str
    category: str
    sub_category: Optional[str]
    title: Optional[str]
    description: Optional[str]
    tags: Optional[List[str]]
    auto_summary: Optional[str]
    mentioned_tables: Optional[List[str]]
    file_size: int
    use_count: int
    created_at: str


class KnowledgeSearchRequest(BaseModel):
    """知识搜索请求"""
    query: str = Field(..., min_length=1, description="搜索关键词")
    limit: int = Field(10, ge=1, le=50, description="返回数量限制")


class KnowledgeExploreRequest(BaseModel):
    """知识探索请求"""
    command: str = Field(..., description="Shell 命令 (grep/find/cat/ls/head/tail/wc)")


# ==================== API 接口 ====================

@router.get("/files", response_model=dict)
async def list_knowledge_files(
    datasource_id: Optional[str] = Query(None, description="数据源ID（为空表示全局知识）"),
    category: Optional[str] = Query(None, description="类别筛选"),
    sub_category: Optional[str] = Query(None, description="子类别筛选"),
    limit: int = Query(50, ge=1, le=100, description="返回数量限制"),
    db: AsyncSession = Depends(get_db),
):
    """获取知识文件列表"""
    service = KnowledgeService(db)
    files = await service.list_files(
        datasource_id=datasource_id,
        category=category,
        sub_category=sub_category,
        limit=limit,
    )

    result = [
        {
            "id": f.id,
            "datasource_id": f.datasource_id,
            "filename": f.filename,
            "file_type": f.file_type,
            "category": f.category,
            "sub_category": f.sub_category,
            "title": f.title,
            "description": f.description,
            "tags": f.tags or [],
            "auto_summary": f.auto_summary,
            "mentioned_tables": f.mentioned_tables or [],
            "file_size": f.file_size,
            "use_count": f.use_count,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in files
    ]

    return {"code": 0, "data": result}


@router.post("/files", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_file(
    file: UploadFile = File(..., description="知识文件"),
    datasource_id: Optional[str] = Query(None, description="数据源ID（为空表示全局知识）"),
    category: str = Query("raw", description="类别: raw/curated"),
    sub_category: Optional[str] = Query(None, description="子类别"),
    title: Optional[str] = Query(None, description="标题"),
    description: Optional[str] = Query(None, description="描述"),
    tags: Optional[str] = Query(None, description="标签（逗号分隔）"),
    db: AsyncSession = Depends(get_db),
):
    """上传知识文件

    支持格式: txt, md, docx, pdf
    最大大小: 10MB
    """
    service = KnowledgeService(db)

    # 解析标签
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None

    # 读取文件内容
    content = await file.read()

    try:
        knowledge_file = await service.upload_file(
            datasource_id=datasource_id,
            filename=file.filename or "unknown",
            content=content,
            category=category,
            sub_category=sub_category,
            title=title,
            description=description,
            tags=tag_list,
        )

        return {
            "code": 0,
            "data": {
                "id": knowledge_file.id,
                "filename": knowledge_file.filename,
                "file_type": knowledge_file.file_type,
                "category": knowledge_file.category,
                "sub_category": knowledge_file.sub_category,
                "title": knowledge_file.title,
                "file_size": knowledge_file.file_size,
                "auto_summary": knowledge_file.auto_summary,
                "mentioned_tables": knowledge_file.mentioned_tables,
                "created_at": knowledge_file.created_at.isoformat() if knowledge_file.created_at else None,
            },
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCode.VALIDATION_ERROR,
                "message": str(e),
            },
        )


@router.get("/files/{file_id}", response_model=dict)
async def get_knowledge_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取知识文件详情"""
    service = KnowledgeService(db)
    knowledge_file = await service.get_file(file_id)

    if not knowledge_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "知识文件不存在",
            },
        )

    return {
        "code": 0,
        "data": {
            "id": knowledge_file.id,
            "datasource_id": knowledge_file.datasource_id,
            "filename": knowledge_file.filename,
            "file_type": knowledge_file.file_type,
            "category": knowledge_file.category,
            "sub_category": knowledge_file.sub_category,
            "title": knowledge_file.title,
            "description": knowledge_file.description,
            "tags": knowledge_file.tags or [],
            "auto_summary": knowledge_file.auto_summary,
            "mentioned_tables": knowledge_file.mentioned_tables or [],
            "file_size": knowledge_file.file_size,
            "use_count": knowledge_file.use_count,
            "created_at": knowledge_file.created_at.isoformat() if knowledge_file.created_at else None,
            "updated_at": knowledge_file.updated_at.isoformat() if knowledge_file.updated_at else None,
        },
    }


@router.get("/files/{file_id}/content", response_class=PlainTextResponse)
async def get_knowledge_file_content(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取知识文件内容（纯文本）"""
    service = KnowledgeService(db)
    content = await service.get_file_content(file_id)

    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "知识文件不存在或内容无法读取",
            },
        )

    return content


@router.delete("/files/{file_id}", response_model=dict)
async def delete_knowledge_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除知识文件"""
    service = KnowledgeService(db)
    success = await service.delete_file(file_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "知识文件不存在",
            },
        )

    return {"code": 0, "message": "知识文件已删除"}


@router.post("/search", response_model=dict)
async def search_knowledge(
    request: KnowledgeSearchRequest,
    datasource_id: Optional[str] = Query(None, description="数据源ID"),
    db: AsyncSession = Depends(get_db),
):
    """搜索知识文件（基于 grep）"""
    service = KnowledgeService(db)
    results = await service.search_files(
        datasource_id=datasource_id,
        query=request.query,
        limit=request.limit,
    )

    return {"code": 0, "data": results}


@router.post("/explore", response_model=dict)
async def explore_knowledge(
    request: KnowledgeExploreRequest,
    datasource_id: Optional[str] = Query(None, description="数据源ID"),
    db: AsyncSession = Depends(get_db),
):
    """探索知识库（执行允许的 shell 命令）

    允许的命令: grep, find, cat, ls, head, tail, wc
    """
    service = KnowledgeService(db)
    output = service.explore_knowledge(
        datasource_id=datasource_id,
        command=request.command,
    )

    return {"code": 0, "data": {"output": output}}


@router.get("/structure", response_model=dict)
async def list_knowledge_structure(
    datasource_id: Optional[str] = Query(None, description="数据源ID"),
    db: AsyncSession = Depends(get_db),
):
    """列出知识库目录结构"""
    service = KnowledgeService(db)
    structure = service.list_knowledge_structure(datasource_id=datasource_id)

    return {"code": 0, "data": {"structure": structure}}