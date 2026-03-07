"""数据源服务"""

from datetime import datetime
from typing import Optional
from app.models import (
    DataSourceCreate,
    DataSourceTest,
    DataSourceResponse,
    DataSourceStatus,
    SchemaInfo,
)
from app.core import encrypt_password, decrypt_password

# 内存存储
_datasources: dict[str, dict] = {}


async def list_datasources() -> list[DataSourceResponse]:
    """获取所有数据源"""
    result = []
    for ds_id, ds in _datasources.items():
        result.append(DataSourceResponse(
            id=ds_id,
            name=ds["name"],
            type=ds["type"],
            host=ds["host"],
            port=ds["port"],
            database=ds["database"],
            status=ds.get("status", DataSourceStatus.CONNECTED),
            created_at=ds["created_at"],
        ))
    return result


async def create_datasource(data: DataSourceCreate) -> DataSourceResponse:
    """创建数据源"""
    from app.services.db_service import test_database_connection

    # 测试连接
    conn_result = await test_database_connection(
        db_type=data.type.value,
        host=data.host,
        port=data.port,
        database=data.database,
        username=data.username,
        password=data.password,
        schema_name=data.schema_name,
    )

    if not conn_result["success"]:
        raise Exception(conn_result["message"])

    # 生成 ID
    ds_id = f"ds_{len(_datasources) + 1:03d}"

    # 加密密码后存储
    encrypted_password = encrypt_password(data.password)

    # 存储数据源
    _datasources[ds_id] = {
        "name": data.name,
        "type": data.type,
        "host": data.host,
        "port": data.port,
        "database": data.database,
        "username": data.username,
        "password": encrypted_password,  # 加密存储
        "schema_name": data.schema_name,
        "status": DataSourceStatus.CONNECTED,
        "created_at": datetime.utcnow(),
    }

    return DataSourceResponse(
        id=ds_id,
        name=data.name,
        type=data.type,
        host=data.host,
        port=data.port,
        database=data.database,
        status=DataSourceStatus.CONNECTED,
        created_at=_datasources[ds_id]["created_at"],
    )


async def test_connection(data: DataSourceTest) -> dict:
    """测试数据库连接"""
    from app.services.db_service import test_database_connection

    return await test_database_connection(
        db_type=data.type.value,
        host=data.host,
        port=data.port,
        database=data.database,
        username=data.username,
        password=data.password,
        schema_name=data.schema_name,
    )


async def delete_datasource(datasource_id: str) -> bool:
    """删除数据源"""
    if datasource_id in _datasources:
        del _datasources[datasource_id]
        return True
    return False


async def get_datasource(datasource_id: str) -> Optional[dict]:
    """获取数据源详情（密码已解密）"""
    ds = _datasources.get(datasource_id)
    if ds is None:
        return None

    # 返回解密后的数据（用于内部使用）
    return {
        **ds,
        "password": decrypt_password(ds["password"]),
    }


async def get_schema(datasource_id: str) -> Optional[SchemaInfo]:
    """获取数据源 Schema"""
    from app.services.db_service import get_database_schema

    ds = await get_datasource(datasource_id)
    if ds is None:
        return None

    return await get_database_schema(
        db_type=ds["type"].value,
        host=ds["host"],
        port=ds["port"],
        database=ds["database"],
        username=ds["username"],
        password=ds["password"],
        schema_name=ds.get("schema_name"),
    )