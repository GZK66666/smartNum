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
    llm_timeout: int = 60  # LLM API 请求超时（秒）

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

    # RAGFLOW 配置
    ragflow_api_base: str = "http://172.32.25.1:10001"
    ragflow_api_key: str = "ragflow-c5NjUxNDcwNWFmZjExZjA5NDBjY2UwNG"
    ragflow_knowledge_base_id: str = ""  # 全局知识库 ID，需要用户填写
    ragflow_top_k: int = 5  # 默认返回片段数
    ragflow_score_threshold: float = 0.5  # 最低相似度阈值

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()
