"""JWT 工具模块"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# JWT 配置
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建 JWT Access Token

    Args:
        data: token 中要存储的数据（通常包含 user_id）
        expires_delta: 过期时间增量

    Returns:
        JWT token 字符串
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)

    return encoded_jwt


def verify_access_token(token: str) -> Optional[dict]:
    """
    验证 JWT Access Token

    Args:
        token: JWT token 字符串

    Returns:
        验证成功返回 payload 数据，失败返回 None
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_token_expire_time() -> datetime:
    """获取 token 过期时间"""
    return datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
