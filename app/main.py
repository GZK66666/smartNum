"""SmartNum V3.0 - 智能问数系统主应用"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import get_settings
from app.models.database import init_db, close_db
from app.routers import datasources, sessions, auth, knowledge
from app.services.checkpointer import init_checkpointer, close_checkpointer

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print("🚀 SmartNum V3.0 服务启动中...")
    print(f"   - 调试模式：{settings.debug}")
    print(f"   - 监听地址：{settings.host}:{settings.port}")
    print(f"   - 数据库：{settings.db_host}:{settings.db_port}/{settings.db_name}")

    # 初始化数据库表
    try:
        await init_db()
        print("✅ 数据库初始化完成")
    except Exception as e:
        print(f"❌ 数据库初始化失败：{e}")
        raise

    # 初始化 Checkpointer
    try:
        await init_checkpointer()
        print("✅ Checkpointer 初始化完成")
    except Exception as e:
        print(f"⚠️ Checkpointer 初始化失败（将使用内存模式）：{e}")

    yield

    # 关闭时
    print("👋 SmartNum 服务关闭")
    await close_checkpointer()
    await close_db()


# 创建 FastAPI 应用
app = FastAPI(
    title="SmartNum API",
    description="智能问数系统 V3.0 - 通过自然语言查询数据库，支持用户认证和数据持久化",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(datasources.router)
app.include_router(sessions.router)
app.include_router(knowledge.router)


# 健康检查接口
@app.get("/health", response_model=dict, tags=["系统"])
async def health_check():
    """健康检查"""
    return {
        "code": 0,
        "data": {
            "status": "healthy",
            "version": "3.0.0",
        }
    }


# 根路径
@app.get("/", response_model=dict, tags=["系统"])
async def root():
    """根路径"""
    return {
        "code": 0,
        "message": "欢迎使用 SmartNum V3.0 智能问数系统",
        "data": {
            "docs": "/docs",
            "health": "/health",
            "auth": "/api/auth",
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
