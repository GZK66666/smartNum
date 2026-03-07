"""数据源管理路由"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from app.models import (
    ApiResponse,
    DataSourceCreate,
    DataSourceTest,
    DataSourceResponse,
    DataSourceStatus,
    SchemaInfo,
    ErrorCode,
)
from app.services import datasource_service

router = APIRouter(prefix="/api/datasources", tags=["数据源管理"])


@router.get("", response_model=ApiResponse)
async def list_datasources():
    """获取数据源列表"""
    datasources = await datasource_service.list_datasources()
    return ApiResponse(data=datasources)


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_datasource(data: DataSourceCreate):
    """添加数据源"""
    try:
        datasource = await datasource_service.create_datasource(data)
        return ApiResponse(data=datasource)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCode.DB_CONNECTION_FAILED,
                "message": f"创建数据源失败: {str(e)}",
            },
        )


@router.post("/test", response_model=ApiResponse)
async def test_connection(data: DataSourceTest):
    """测试数据库连接"""
    result = await datasource_service.test_connection(data)
    if result["success"]:
        return ApiResponse(data=result)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCode.DB_CONNECTION_FAILED,
                "message": result["message"],
                "details": result.get("details"),
            },
        )


@router.delete("/{datasource_id}", response_model=ApiResponse)
async def delete_datasource(datasource_id: str):
    """删除数据源"""
    success = await datasource_service.delete_datasource(datasource_id)
    if success:
        return ApiResponse(message="数据源已删除")
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCode.DATASOURCE_NOT_FOUND,
                "message": "数据源不存在",
            },
        )


@router.get("/{datasource_id}/schema", response_model=ApiResponse)
async def get_schema(datasource_id: str):
    """获取数据源 Schema"""
    try:
        schema_info = await datasource_service.get_schema(datasource_id)
        if schema_info is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": ErrorCode.DATASOURCE_NOT_FOUND,
                    "message": "数据源不存在",
                },
            )
        return ApiResponse(data=schema_info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.DB_SCHEMA_LOAD_FAILED,
                "message": f"加载 Schema 失败: {str(e)}",
            },
        )