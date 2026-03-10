"""数据库连接管理"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.core.config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    """SQLAlchemy 声明式基类"""
    pass


# 构建异步数据库 URL
def get_database_url() -> str:
    """获取数据库连接 URL"""
    return (
        f"mysql+aiomysql://"
        f"{settings.db_username}:{settings.db_password}@"
        f"{settings.db_host}:{settings.db_port}/"
        f"{settings.db_name}?charset=utf8mb4"
    )


# 创建异步引擎
engine = create_async_engine(
    get_database_url(),
    echo=settings.debug,  # 调试模式输出 SQL
    pool_size=20,  # 连接池大小
    max_overflow=40,  # 最大溢出连接数
    pool_pre_ping=True,  # 连接前 ping 检测
    pool_recycle=3600,  # 1 小时回收连接
)


# 异步 Session 工厂
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话（依赖注入）"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """初始化数据库（创建所有表）"""
    async with engine.begin() as conn:
        # 导入所有模型以确保表被创建
        from app.models import models  # noqa
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """关闭数据库连接"""
    await engine.dispose()
