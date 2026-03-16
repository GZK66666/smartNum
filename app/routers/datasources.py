"""数据源管理路由 - V3.0 版本"""

from fastapi import APIRouter, HTTPException, status, Depends, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List

from app.models.database import get_db
from app.routers.auth import get_current_user_id
from app.services.datasource_service import DataSourceService
from app.services.db_service import test_database_connection
from app.models import ErrorCode

router = APIRouter(prefix="/api/datasources", tags=["数据源管理"])


# ==================== 请求模型 ====================

class DataSourceCreateRequest(BaseModel):
    """创建数据源请求"""
    name: str = Field(..., min_length=1, max_length=100, description="数据源名称")
    type: str = Field(..., description="数据库类型：mysql/postgresql/sqlite")
    host: str = Field(..., description="主机地址")
    port: int = Field(..., ge=1, le=65535, description="端口号")
    database: str = Field(..., description="数据库名称")
    username: str = Field(..., description="数据库用户名")
    password: str = Field(..., description="数据库密码")
    schema_name: Optional[str] = Field(None, description="Schema 名称（PostgreSQL）")


class DataSourceTestRequest(BaseModel):
    """测试连接请求"""
    type: str = Field(..., description="数据库类型")
    host: str = Field(..., description="主机地址")
    port: int = Field(..., ge=1, le=65535, description="端口号")
    database: str = Field(..., description="数据库名称")
    username: str = Field(..., description="数据库用户名")
    password: str = Field(..., description="数据库密码")
    schema_name: Optional[str] = Field(None, description="Schema 名称")


class DataSourceResponse(BaseModel):
    """数据源响应"""
    id: str
    name: str
    type: str
    host: str
    port: int
    database: str
    status: str = "connected"


class SchemaInfo(BaseModel):
    """Schema 信息响应"""
    tables: list[dict]


# ==================== API 接口 ====================

@router.get("", response_model=dict)
async def list_datasources(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """获取数据源列表"""
    service = DataSourceService(db, user_id)
    datasources = await service.list_datasources()

    result = [
        {
            "id": ds.id,
            "name": ds.name,
            "type": ds.type,
            "host": ds.host,
            "port": ds.port,
            "database": ds.database_name,
            "status": "connected" if ds.status == 1 else "disconnected",
            "created_at": ds.created_at,
        }
        for ds in datasources
    ]

    return {"code": 0, "data": result}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_datasource(
    request: DataSourceCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """添加数据源"""
    service = DataSourceService(db, user_id)

    try:
        datasource = await service.create_datasource(
            name=request.name,
            type=request.type,
            host=request.host,
            port=request.port,
            database=request.database,
            username=request.username,
            password=request.password,
            schema_name=request.schema_name,
        )

        return {
            "code": 0,
            "data": {
                "id": datasource.id,
                "name": datasource.name,
                "type": datasource.type,
                "host": datasource.host,
                "port": datasource.port,
                "database": datasource.database_name,
                "status": "connected",
                "created_at": datasource.created_at,
            },
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCode.DB_CONNECTION_FAILED,
                "message": str(e),
            },
        )


@router.post("/test", response_model=dict)
async def test_connection(request: DataSourceTestRequest):
    """测试数据库连接"""
    result = await test_database_connection(
        db_type=request.type,
        host=request.host,
        port=request.port,
        database=request.database,
        username=request.username,
        password=request.password,
        schema_name=request.schema_name,
    )

    if result["success"]:
        return {"code": 0, "data": result}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCode.DB_CONNECTION_FAILED,
                "message": result["message"],
                "details": result.get("details"),
            },
        )


@router.delete("/{datasource_id}", response_model=dict)
async def delete_datasource(
    datasource_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """删除数据源（同时删除关联的会话）"""
    from sqlalchemy import select, func
    from app.models.models import Session

    service = DataSourceService(db, user_id)

    # 检查数据源是否存在
    datasource = await service.get_datasource(datasource_id)
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "数据源不存在",
            },
        )

    # 统计关联的会话数量
    result = await db.execute(
        select(func.count(Session.id)).where(Session.datasource_id == datasource_id)
    )
    session_count = result.scalar() or 0

    # 删除数据源（级联删除会话）
    await service.delete_datasource(datasource_id)

    return {
        "code": 0,
        "message": "数据源已删除",
        "data": {
            "deleted_sessions": session_count,
        }
    }


@router.get("/{datasource_id}/schema", response_model=dict)
async def get_schema(
    datasource_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """获取数据源 Schema"""
    service = DataSourceService(db, user_id)

    # 获取数据源凭证
    credentials = await service.get_datasource_credentials(datasource_id)
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "数据源不存在",
            },
        )

    # 获取 Schema
    from app.services.db_service import get_database_schema
    schema_info = await get_database_schema(
        db_type=credentials["type"],
        host=credentials["host"],
        port=credentials["port"],
        database=credentials["database"],
        username=credentials["username"],
        password=credentials["password"],
        schema_name=credentials.get("schema_name"),
    )

    if schema_info is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.DB_SCHEMA_LOAD_FAILED,
                "message": "加载 Schema 失败",
            },
        )

    return {"code": 0, "data": schema_info}


@router.post("/upload", response_model=dict)
async def upload_file_datasource(
    name: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """上传文件创建数据源

    流程：
    1. 验证文件格式
    2. 保存文件
    3. 创建数据源记录
    4. 返回预览和表信息
    """
    from app.services.file_datasource_service import FileDatasourceService
    import uuid

    file_service = FileDatasourceService()

    # 验证文件
    validation = await file_service.validate_file(file)
    if not validation["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.INVALID_REQUEST, "message": validation["message"]},
        )

    # 生成数据源 ID
    datasource_id = str(uuid.uuid4())

    # 保存文件
    raw_path, file_ext = await file_service.save_file(datasource_id, file)

    # 预览文件
    preview = await file_service.preview_file(raw_path)

    if not preview["success"]:
        # 清理已上传的文件
        await file_service.cleanup_datasource_files(datasource_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.INVALID_REQUEST, "message": f"文件解析失败: {preview.get('error', '未知错误')}"},
        )

    # 获取表信息
    tables_info = await file_service.get_tables_info(datasource_id)

    # 创建数据源记录
    ds_service = DataSourceService(db, user_id)
    try:
        datasource = await ds_service.create_datasource(
            name=name,
            type="file",
            file_path=raw_path,
            tables_info=tables_info,
            datasource_id=datasource_id,
        )
    except Exception as e:
        # 清理已上传的文件
        await file_service.cleanup_datasource_files(datasource_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.DB_CONNECTION_FAILED, "message": str(e)},
        )

    return {
        "code": 0,
        "data": {
            "id": datasource.id,
            "name": datasource.name,
            "type": datasource.type,
            "status": "connected",
            "tables": tables_info,
            "preview": {
                "columns": preview["columns"],
                "data": preview["data"][:10],  # 最多返回 10 行预览
                "total_rows": preview["total_rows"],
            },
            "created_at": datasource.created_at,
        },
    }


@router.post("/upload/preview", response_model=dict)
async def preview_upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """预览上传的文件（不创建数据源）

    用于在上传前预览文件内容
    """
    from app.services.file_datasource_service import FileDatasourceService
    import tempfile
    import os

    file_service = FileDatasourceService()

    # 验证文件
    validation = await file_service.validate_file(file)
    if not validation["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.INVALID_REQUEST, "message": validation["message"]},
        )

    # 保存到临时文件
    content = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=validation["file_ext"]) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # 预览文件
        preview = await file_service.preview_file(tmp_path)

        if not preview["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": ErrorCode.INVALID_REQUEST, "message": f"文件解析失败: {preview.get('error', '未知错误')}"},
            )

        return {
            "code": 0,
            "data": {
                "filename": file.filename,
                "columns": preview["columns"],
                "data": preview["data"][:20],  # 返回 20 行预览
                "total_rows": preview["total_rows"],
            },
        }
    finally:
        # 清理临时文件
        os.unlink(tmp_path)
