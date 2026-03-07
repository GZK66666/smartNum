"""安全工具模块"""

import base64
import hashlib
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core import get_settings

settings = get_settings()


class PasswordEncryption:
    """密码加密工具（内存加密存储）"""

    def __init__(self):
        # 使用配置中的密钥生成 Fernet 密钥
        key = self._derive_key(settings.secret_key)
        self._fernet = Fernet(key)

    def _derive_key(self, secret: str) -> bytes:
        """从密钥派生 Fernet 密钥"""
        # 使用固定的 salt（内存加密，不需要持久化）
        salt = b'smartnum_salt_v1'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
        return key

    def encrypt(self, password: str) -> str:
        """加密密码"""
        if not password:
            return ""
        return self._fernet.encrypt(password.encode()).decode()

    def decrypt(self, encrypted: str) -> str:
        """解密密码"""
        if not encrypted:
            return ""
        return self._fernet.decrypt(encrypted.encode()).decode()


# 全局加密实例
_password_encryption = None


def get_password_encryption() -> PasswordEncryption:
    """获取密码加密实例（单例）"""
    global _password_encryption
    if _password_encryption is None:
        _password_encryption = PasswordEncryption()
    return _password_encryption


def encrypt_password(password: str) -> str:
    """加密密码（便捷函数）"""
    return get_password_encryption().encrypt(password)


def decrypt_password(encrypted: str) -> str:
    """解密密码（便捷函数）"""
    return get_password_encryption().decrypt(encrypted)