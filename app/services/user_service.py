"""用户认证服务"""

from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.models.models import User
from app.core.security import hash_password, verify_password
from app.core.jwt import create_access_token


class UserService:
    """用户服务类"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """根据 ID 获取用户"""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> Optional[User]:
        """根据用户名获取用户"""
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def create_user(
        self,
        username: str,
        password: str,
        email: Optional[str] = None,
    ) -> Tuple[User, str]:
        """
        创建新用户

        Args:
            username: 用户名
            password: 密码
            email: 邮箱

        Returns:
            (用户对象，access_token)
        """
        # 检查用户名是否已存在
        existing = await self.get_user_by_username(username)
        if existing:
            raise ValueError("用户名已存在")

        # 创建用户
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            password_hash=hash_password(password),
            email=email,
            status=1,
        )

        self.db.add(user)
        await self.db.flush()  # 获取 user_id

        # 生成 JWT token
        access_token = create_access_token(data={"user_id": user.id, "username": user.username})

        return user, access_token

    async def authenticate_user(
        self,
        username: str,
        password: str,
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        用户认证

        Args:
            username: 用户名
            password: 密码

        Returns:
            (用户对象，access_token)，认证失败返回 (None, None)
        """
        user = await self.get_user_by_username(username)
        if not user:
            return None, None

        if user.status != 1:
            return None, None  # 用户已禁用

        if not verify_password(password, user.password_hash):
            return None, None

        # 生成 JWT token
        access_token = create_access_token(data={"user_id": user.id, "username": user.username})

        return user, access_token

    async def update_user(
        self,
        user_id: str,
        email: Optional[str] = None,
        password: Optional[str] = None,
    ) -> Optional[User]:
        """更新用户信息"""
        user = await self.get_user_by_id(user_id)
        if not user:
            return None

        if email is not None:
            user.email = email

        if password is not None:
            user.password_hash = hash_password(password)

        await self.db.flush()
        return user

    async def delete_user(self, user_id: str) -> bool:
        """删除用户（级联删除所有关联数据）"""
        user = await self.get_user_by_id(user_id)
        if not user:
            return False

        await self.db.delete(user)
        await self.db.flush()
        return True


# ==================== 便捷函数 ====================

async def get_current_user(
    db: AsyncSession,
    user_id: str,
) -> Optional[User]:
    """根据 user_id 获取当前用户"""
    service = UserService(db)
    return await service.get_user_by_id(user_id)
