"""数据模型定义"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


# ==================== 枚举类型 ====================

class DatabaseType(str, Enum):
    """数据库类型"""
    MYSQL = "mysql"
    POSTGRESQL = "postgresql"
    SQLITE = "sqlite"


class DataSourceStatus(str, Enum):
    """数据源状态"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


# ==================== 数据源相关模型 ====================

class DataSourceCreate(BaseModel):
    """创建数据源请求"""
    name: str = Field(..., description="数据源名称", min_length=1, max_length=100)
    type: DatabaseType = Field(..., description="数据库类型")
    host: str = Field(..., description="主机地址")
    port: int = Field(..., ge=1, le=65535, description="端口号")
    database: str = Field(..., description="数据库名称")
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")
    schema_name: Optional[str] = Field(None, description="Schema名称（PostgreSQL）")


class DataSourceTest(BaseModel):
    """测试连接请求"""
    type: DatabaseType
    host: str
    port: int = Field(..., ge=1, le=65535)
    database: str
    username: str
    password: str
    schema_name: Optional[str] = None


class DataSourceResponse(BaseModel):
    """数据源响应"""
    id: str
    name: str
    type: DatabaseType
    host: str
    port: int
    database: str
    status: DataSourceStatus
    created_at: datetime


# ==================== Schema 相关模型 ====================

class ColumnInfo(BaseModel):
    """列信息"""
    name: str
    type: str
    nullable: bool
    key: Optional[str] = None
    default: Optional[str] = None
    comment: Optional[str] = None


class ForeignKey(BaseModel):
    """外键信息"""
    name: str
    columns: list[str]
    ref_table: str
    ref_columns: list[str]


class TableInfo(BaseModel):
    """表信息"""
    name: str
    comment: Optional[str] = None
    columns: list[ColumnInfo]
    primary_keys: list[str] = []
    foreign_keys: list[ForeignKey] = []


class SchemaInfo(BaseModel):
    """Schema 信息"""
    database: str
    tables: list[TableInfo]
    loaded_at: datetime


# ==================== 会话相关模型 ====================

class SessionCreate(BaseModel):
    """创建会话请求"""
    datasource_id: str


class SessionResponse(BaseModel):
    """会话响应"""
    session_id: str
    datasource_id: str
    created_at: datetime


# ==================== 消息相关模型 ====================

class MessageCreate(BaseModel):
    """发送消息请求"""
    content: str = Field(..., min_length=1, max_length=10000)


class QueryResult(BaseModel):
    """查询结果"""
    columns: list[str]
    rows: list[list[Any]]
    total: int
    truncated: bool
    execution_time: Optional[float] = None


class MessageResponse(BaseModel):
    """消息响应"""
    id: str
    role: str
    content: str
    sql: Optional[str] = None
    result: Optional[QueryResult] = None
    error: Optional[str] = None
    created_at: datetime


class MessageHistory(BaseModel):
    """消息历史"""
    session_id: str
    messages: list[MessageResponse]


# ==================== 通用响应模型 ====================

class ApiResponse(BaseModel):
    """通用 API 响应"""
    code: int = 0
    message: str = "success"
    data: Any = None


class ErrorResponse(BaseModel):
    """错误响应"""
    code: int
    message: str
    details: Optional[dict[str, Any]] = None


# ==================== 错误码定义 ====================

class ErrorCode:
    """错误码常量"""
    # 数据库相关错误
    DB_CONNECTION_FAILED = 1001
    DB_AUTH_FAILED = 1002
    DB_NOT_FOUND = 1003
    DB_SCHEMA_LOAD_FAILED = 1004

    # SQL 相关错误
    SQL_GENERATION_FAILED = 2001
    SQL_EXECUTION_FAILED = 2002
    SQL_TIMEOUT = 2003
    SQL_RESULT_TOO_LARGE = 2004

    # 会话相关错误
    SESSION_NOT_FOUND = 3001
    SESSION_EXPIRED = 3002

    # 请求相关错误
    INVALID_REQUEST = 4001
    DATASOURCE_NOT_FOUND = 4002