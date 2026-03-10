"""用户认证路由"""

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.models.database import get_db
from app.services.user_service import UserService
from app.core.security import hash_password, verify_password
from app.core.jwt import create_access_token

router = APIRouter(prefix="/api/auth", tags=["用户认证"])
security = HTTPBearer()


# ==================== 请求/响应模型 ====================

class RegisterRequest(BaseModel):
    """注册请求"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    password: str = Field(..., min_length=6, max_length=50, description="密码")
    email: str | None = Field(None, max_length=100, description="邮箱")


class LoginRequest(BaseModel):
    """登录请求"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class AuthResponse(BaseModel):
    """认证响应"""
    user_id: str
    username: str
    email: str | None
    access_token: str
    token_type: str = "Bearer"


class UserResponse(BaseModel):
    """用户信息响应"""
    user_id: str
    username: str
    email: str | None
    status: int


# ==================== 依赖注入 ====================

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    获取当前登录用户 ID

    从 Authorization Header 中提取 JWT token 并验证
    """
    from app.core.jwt import verify_access_token

    token = credentials.credentials
    payload = verify_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Token 无效或已过期"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Token 中缺少 user_id"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 验证用户是否存在
    service = UserService(db)
    user = await service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "用户不存在"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


# ==================== API 接口 ====================

@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    用户注册

    创建新用户并返回 JWT token
    """
    service = UserService(db)

    try:
        user, access_token = await service.create_user(
            username=request.username,
            password=request.password,
            email=request.email,
        )

        return AuthResponse(
            user_id=user.id,
            username=user.username,
            email=user.email,
            access_token=access_token,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "REGISTER_FAILED", "message": str(e)},
        )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    用户登录

    验证用户名密码，返回 JWT token
    """
    service = UserService(db)

    user, access_token = await service.authenticate_user(
        username=request.username,
        password=request.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "LOGIN_FAILED", "message": "用户名或密码错误"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthResponse(
        user_id=user.id,
        username=user.username,
        email=user.email,
        access_token=access_token,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    获取当前登录用户信息
    """
    service = UserService(db)
    user = await service.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "用户不存在"},
        )

    return UserResponse(
        user_id=user.id,
        username=user.username,
        email=user.email,
        status=user.status,
    )


@router.post("/change-password")
async def change_password(
    old_password: str = Body(..., embed=True, description="原密码"),
    new_password: str = Body(..., embed=True, min_length=6, description="新密码"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    修改密码
    """
    service = UserService(db)
    user = await service.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "用户不存在"},
        )

    # 验证原密码
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "WRONG_PASSWORD", "message": "原密码错误"},
        )

    # 更新密码
    await service.update_user(user_id, password=new_password)

    return {"message": "密码修改成功"}
