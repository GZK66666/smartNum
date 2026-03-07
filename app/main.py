"""SmartNum - 智能问数系统主应用"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import get_settings
from app.routers import datasources, sessions
from app.models import ApiResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print("🚀 SmartNum 服务启动中...")
    print(f"   - 调试模式: {settings.debug}")
    print(f"   - 监听地址: {settings.host}:{settings.port}")

    yield

    # 关闭时
    print("👋 SmartNum 服务关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="SmartNum API",
    description="智能问数系统 - 通过自然语言查询数据库",
    version="1.0.0",
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
app.include_router(datasources.router)
app.include_router(sessions.router)


# 健康检查接口
@app.get("/health", response_model=ApiResponse, tags=["系统"])
async def health_check():
    """健康检查"""
    return ApiResponse(
        data={
            "status": "healthy",
            "version": "1.0.0",
        }
    )


# 根路径
@app.get("/", response_model=ApiResponse, tags=["系统"])
async def root():
    """根路径"""
    return ApiResponse(
        message="欢迎使用 SmartNum 智能问数系统",
        data={
            "docs": "/docs",
            "health": "/health",
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )