"""数据源服务 - V3.0 持久化版本"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.models.models import DataSource
from app.services.db_service import test_database_connection, get_database_schema


class DataSourceService:
    """数据源服务类"""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def list_datasources(self) -> List[DataSource]:
        """获取当前用户的所有数据源"""
        result = await self.db.execute(
            select(DataSource).where(DataSource.user_id == self.user_id)
        )
        return list(result.scalars().all())

    async def get_datasource(self, datasource_id: str) -> Optional[DataSource]:
        """获取数据源详情"""
        result = await self.db.execute(
            select(DataSource).where(
                DataSource.id == datasource_id,
                DataSource.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create_datasource(
        self,
        name: str,
        type: str,
        host: str = None,
        port: int = None,
        database: str = None,
        username: str = None,
        password: str = None,
        schema_name: Optional[str] = None,
        file_path: Optional[str] = None,
        tables_info: Optional[List[dict]] = None,
        datasource_id: Optional[str] = None,
    ) -> DataSource:
        """创建数据源"""
        # 文件类型不需要测试连接
        if type != "file":
            # 测试连接
            conn_result = await test_database_connection(
                db_type=type,
                host=host,
                port=port,
                database=database,
                username=username,
                password=password,
                schema_name=schema_name,
            )

            if not conn_result["success"]:
                raise ValueError(f"连接测试失败：{conn_result['message']}")

        # 创建数据源（使用传入的 ID 或生成新的）
        datasource = DataSource(
            id=datasource_id or str(uuid.uuid4()),
            user_id=self.user_id,
            name=name,
            type=type,
            host=host,
            port=port,
            database_name=database,
            db_username=username,
            db_password=password,  # V3.0 暂不加密
            schema_name=schema_name,
            file_path=file_path,
            tables_info=tables_info,
            status=1,
        )

        self.db.add(datasource)
        await self.db.flush()

        return datasource

    async def update_datasource(
        self,
        datasource_id: str,
        name: Optional[str] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        schema_name: Optional[str] = None,
        file_path: Optional[str] = None,
        tables_info: Optional[List[dict]] = None,
    ) -> Optional[DataSource]:
        """更新数据源"""
        datasource = await self.get_datasource(datasource_id)
        if not datasource:
            return None

        # 测试新连接（如果有修改连接信息，且不是文件类型）
        # 空字符串视为未修改
        if datasource.type != "file" and (host or port or database or username or password):
            conn_result = await test_database_connection(
                db_type=datasource.type,
                host=host or datasource.host,
                port=port or datasource.port,
                database=database or datasource.database_name,
                username=username or datasource.db_username,
                password=password or datasource.db_password,
                schema_name=schema_name or datasource.schema_name,
            )
            if not conn_result["success"]:
                raise ValueError(f"连接测试失败：{conn_result['message']}")

        # 更新字段 - 空字符串不视为有效值，不会覆盖原有数据
        if name is not None and name != "":
            datasource.name = name
        if host is not None and host != "":
            datasource.host = host
        if port is not None and port != 0:
            datasource.port = port
        if database is not None and database != "":
            datasource.database_name = database
        if username is not None and username != "":
            datasource.db_username = username
        if password is not None and password != "":
            datasource.db_password = password
        if schema_name is not None and schema_name != "":
            datasource.schema_name = schema_name
        if file_path is not None:
            datasource.file_path = file_path
        if tables_info is not None:
            datasource.tables_info = tables_info

        await self.db.flush()
        return datasource

    async def delete_datasource(self, datasource_id: str) -> bool:
        """删除数据源"""
        datasource = await self.get_datasource(datasource_id)
        if not datasource:
            return False

        # 如果是文件类型，清理文件
        if datasource.type == "file":
            from app.services.file_datasource_service import FileDatasourceService
            service = FileDatasourceService()
            await service.cleanup_datasource_files(datasource_id)

        # 清理查询指南文件
        from app.services.query_guide_service import QueryGuideService
        guide_service = QueryGuideService()
        await guide_service.cleanup_guide_files(datasource_id)

        await self.db.delete(datasource)
        await self.db.flush()
        return True

    async def get_datasource_credentials(self, datasource_id: str) -> Optional[dict]:
        """获取数据源连接凭证（用于数据库操作）"""
        datasource = await self.get_datasource(datasource_id)
        if not datasource:
            return None

        result = {
            "type": datasource.type,
            "host": datasource.host,
            "port": datasource.port,
            "database": datasource.database_name,
            "username": datasource.db_username,
            "password": datasource.db_password,
            "schema_name": datasource.schema_name,
        }

        # 文件类型添加 tables_info
        if datasource.type == "file":
            result["tables_info"] = datasource.tables_info

        return result


# ==================== 便捷函数（兼容旧接口） ====================

# 全局内存存储（用于无用户上下文的情况，如初始化测试）
_datasources: dict[str, dict] = {}


async def list_datasources() -> list:
    """获取所有数据源（内存版本，兼容旧接口）"""
    from app.models import DataSourceResponse, DataSourceStatus
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


async def create_datasource(data) -> dict:
    """创建数据源（内存版本，兼容旧接口）"""
    ds_id = f"ds_{len(_datasources) + 1:03d}"
    _datasources[ds_id] = {
        "name": data.name,
        "type": data.type,
        "host": data.host,
        "port": data.port,
        "database": data.database,
        "username": data.username,
        "password": data.password,
        "schema_name": data.schema_name,
        "status": "connected",
        "created_at": datetime.utcnow(),
    }
    return {"id": ds_id, **_datasources[ds_id]}


async def get_datasource(datasource_id: str) -> Optional[dict]:
    """获取数据源（内存版本，兼容旧接口）"""
    return _datasources.get(datasource_id)


async def delete_datasource(datasource_id: str) -> bool:
    """删除数据源（内存版本，兼容旧接口）"""
    if datasource_id in _datasources:
        del _datasources[datasource_id]
        return True
    return False


async def get_schema(datasource_id: str):
    """获取数据源 Schema（兼容旧接口）"""
    ds = await get_datasource(datasource_id)
    if ds is None:
        return None

    return await get_database_schema(
        db_type=ds["type"].value if hasattr(ds["type"], 'value') else ds["type"],
        host=ds["host"],
        port=ds["port"],
        database=ds["database"],
        username=ds["username"],
        password=ds["password"],
        schema_name=ds.get("schema_name"),
    )


async def test_connection(data) -> dict:
    """测试数据库连接（兼容旧接口）"""
    return await test_database_connection(
        db_type=data.type.value if hasattr(data.type, 'value') else data.type,
        host=data.host,
        port=data.port,
        database=data.database,
        username=data.username,
        password=data.password,
        schema_name=data.schema_name,
    )
