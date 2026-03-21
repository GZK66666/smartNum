"""SQLAlchemy ORM 模型"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index, event, LargeBinary, JSON
from sqlalchemy.dialects.mysql import VARCHAR, LONGTEXT
from sqlalchemy.orm import relationship

from app.models.database import Base


class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(VARCHAR(36), primary_key=True, comment="用户 ID (UUID)")
    username = Column(VARCHAR(50), unique=True, nullable=False, comment="用户名")
    password_hash = Column(VARCHAR(255), nullable=False, comment="密码哈希 (bcrypt)")
    email = Column(VARCHAR(100), comment="邮箱")
    status = Column(Integer, default=1, comment="状态：1-正常 0-禁用")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    datasources = relationship("DataSource", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_username", "username"),
        Index("idx_email", "email"),
    )

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class DataSource(Base):
    """数据源模型"""
    __tablename__ = "datasources"

    id = Column(VARCHAR(36), primary_key=True, comment="数据源 ID (UUID)")
    user_id = Column(VARCHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="所属用户 ID")
    name = Column(VARCHAR(100), nullable=False, comment="数据源名称")
    type = Column(VARCHAR(20), nullable=False, comment="数据库类型：mysql/postgresql/sqlite/file")
    host = Column(VARCHAR(255), comment="主机地址")
    port = Column(Integer, comment="端口")
    database_name = Column(VARCHAR(100), comment="数据库名")
    db_username = Column(VARCHAR(100), comment="数据库用户名")
    db_password = Column(VARCHAR(255), comment="数据库密码")
    schema_name = Column(VARCHAR(100), comment="Schema 名称 (PostgreSQL)")
    # 文件数据源字段
    file_path = Column(VARCHAR(500), comment="原始文件路径（文件类型）")
    tables_info = Column(JSON, comment="转换后的表信息（文件类型）")
    status = Column(Integer, default=1, comment="状态：1-正常 0-禁用")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关系
    user = relationship("User", back_populates="datasources")
    sessions = relationship("Session", back_populates="datasource", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_user_id", "user_id"),
        Index("idx_name", "name"),
    )

    def __repr__(self):
        return f"<DataSource(id={self.id}, name={self.name}, type={self.type})>"


class Session(Base):
    """会话模型"""
    __tablename__ = "sessions"

    id = Column(VARCHAR(36), primary_key=True, comment="会话 ID (UUID)")
    user_id = Column(VARCHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="所属用户 ID")
    datasource_id = Column(VARCHAR(36), ForeignKey("datasources.id", ondelete="CASCADE"), nullable=False, comment="关联数据源 ID")
    title = Column(VARCHAR(200), comment="会话标题")
    message_count = Column(Integer, default=0, comment="消息数量（缓存）")
    is_archived = Column(Integer, default=0, comment="是否归档：1-是 0-否")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    last_active_at = Column(DateTime, default=datetime.utcnow, comment="最后活跃时间")

    # 关系
    user = relationship("User", back_populates="sessions")
    datasource = relationship("DataSource", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan", lazy="dynamic")

    __table_args__ = (
        Index("idx_user_id", "user_id"),
        Index("idx_datasource_id", "datasource_id"),
        Index("idx_last_active", "last_active_at"),
    )

    def __repr__(self):
        return f"<Session(id={self.id}, user_id={self.user_id})>"


class Message(Base):
    """消息模型"""
    __tablename__ = "messages"

    id = Column(VARCHAR(36), primary_key=True, comment="消息 ID (UUID)")
    session_id = Column(VARCHAR(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, comment="关联会话 ID")
    role = Column(VARCHAR(10), nullable=False, comment="角色：user/assistant")
    content = Column(Text, nullable=False, comment="消息内容")
    sql = Column(Text, comment="生成的 SQL 语句")
    result = Column(LONGTEXT, comment="查询结果 (JSON)")
    result_truncated = Column(Integer, default=0, comment="结果是否截断：1-是 0-否")
    agent_steps = Column(LONGTEXT, comment="智能体执行步骤 (JSON)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    # 关系
    session = relationship("Session", back_populates="messages")

    __table_args__ = (
        Index("idx_session_id", "session_id"),
        Index("idx_role", "role"),
        Index("idx_created_at", "created_at"),
    )

    def __repr__(self):
        return f"<Message(id={self.id}, role={self.role}, session_id={self.session_id})>"


class ExportFile(Base):
    """导出文件模型 - 用于持久化导出文件"""
    __tablename__ = "export_files"

    id = Column(VARCHAR(36), primary_key=True, comment="导出文件 ID (UUID)")
    filename = Column(VARCHAR(255), nullable=False, comment="文件名")
    content = Column(LargeBinary, nullable=False, comment="文件内容")
    mime_type = Column(VARCHAR(100), nullable=False, comment="MIME 类型")
    size_kb = Column(Integer, nullable=False, comment="文件大小 (KB)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    expires_at = Column(DateTime, nullable=False, comment="过期时间")

    __table_args__ = (
        Index("idx_expires_at", "expires_at"),
    )

    def __repr__(self):
        return f"<ExportFile(id={self.id}, filename={self.filename})>"
