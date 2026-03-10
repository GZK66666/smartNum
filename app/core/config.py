"""核心配置模块"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""

    # LLM 配置 (OpenAI 兼容格式)
    # 支持阿里百炼、OpenAI、本地 vLLM 等
    llm_api_key: str = ""
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"  # 阿里百炼
    llm_model_name: str = "qwen-plus"  # 阿里百炼：qwen-plus, qwen-turbo, qwen-max
    llm_temperature: float = 0.0
    llm_max_tokens: int = 4096

    # 服务配置
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # 安全配置
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 60 * 24  # JWT 过期时间（分钟）

    # 数据库配置
    max_result_rows: int = 1000
    query_timeout: int = 30
    max_context_messages: int = 10

    # MySQL 数据库配置（持久化层）
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "smartnum"
    db_username: str = "root"
    db_password: str = "123456"

    # CORS
    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()
