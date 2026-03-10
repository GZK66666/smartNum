"""安全工具模块"""

import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import bcrypt

from app.core import get_settings

settings = get_settings()


# ==================== 密码哈希（bcrypt） ====================

def hash_password(password: str) -> str:
    """
    使用 bcrypt 哈希密码

    Args:
        password: 原始密码

    Returns:
        bcrypt 哈希值
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed_password: str) -> bool:
    """
    验证密码

    Args:
        password: 原始密码
        hashed_password: bcrypt 哈希值

    Returns:
        验证成功返回 True，失败返回 False
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


# ==================== 数据源密码加密（Fernet） ====================

class DataEncryption:
    """数据加密工具（用于数据源密码等）"""

    def __init__(self):
        # 使用配置中的密钥生成 Fernet 密钥
        key = self._derive_key(settings.secret_key)
        self._fernet = Fernet(key)

    def _derive_key(self, secret: str) -> bytes:
        """从密钥派生 Fernet 密钥"""
        salt = b'smartnum_salt_v1'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
        return key

    def encrypt(self, data: str) -> str:
        """加密数据"""
        if not data:
            return ""
        return self._fernet.encrypt(data.encode()).decode()

    def decrypt(self, encrypted: str) -> str:
        """解密数据"""
        if not encrypted:
            return ""
        return self._fernet.decrypt(encrypted.encode()).decode()


# 全局加密实例
_data_encryption = None


def get_data_encryption() -> DataEncryption:
    """获取数据加密实例（单例）"""
    global _data_encryption
    if _data_encryption is None:
        _data_encryption = DataEncryption()
    return _data_encryption


def encrypt_data(data: str) -> str:
    """加密数据（便捷函数）"""
    return get_data_encryption().encrypt(data)


def decrypt_data(encrypted: str) -> str:
    """解密数据（便捷函数）"""
    return get_data_encryption().decrypt(data)
