"""数据库连接服务"""

import asyncio
from datetime import datetime
from typing import Any, Optional
from urllib.parse import quote_plus
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models import SchemaInfo, TableInfo, ColumnInfo
from app.core import get_settings

settings = get_settings()


def get_database_url(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
) -> str:
    """构建数据库连接 URL"""
    if db_type == "mysql":
        # 对密码进行 URL 编码，支持特殊字符（包括中文）
        encoded_password = quote_plus(password)
        # 添加 charset=utf8mb4 支持中文密码
        return f"mysql+aiomysql://{username}:{encoded_password}@{host}:{port}/{database}?charset=utf8mb4"
    elif db_type == "postgresql":
        encoded_password = quote_plus(password)
        return f"postgresql+asyncpg://{username}:{encoded_password}@{host}:{port}/{database}"
    elif db_type == "sqlite":
        return f"sqlite+aiosqlite:///{database}"
    else:
        raise ValueError(f"不支持的数据库类型: {db_type}")


async def test_database_connection(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    schema_name: Optional[str] = None,
) -> dict:
    """测试数据库连接"""
    try:
        url = get_database_url(db_type, host, port, database, username, password)
        engine = create_async_engine(url, echo=False)

        async with engine.connect() as conn:
            # 执行简单查询测试连接
            if db_type == "mysql":
                result = await conn.execute(text("SELECT VERSION()"))
                version = result.scalar()
            elif db_type == "postgresql":
                result = await conn.execute(text("SELECT version()"))
                version = result.scalar().split(',')[0]
            elif db_type == "sqlite":
                result = await conn.execute(text("SELECT sqlite_version()"))
                version = f"SQLite {result.scalar()}"
            else:
                version = "Unknown"

        await engine.dispose()

        return {
            "success": True,
            "message": "连接成功",
            "version": version,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"连接失败: {str(e)}",
            "details": {
                "error": str(e),
                "host": host,
                "port": port,
                "database": database,
            },
        }


async def get_database_schema(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    schema_name: Optional[str] = None,
) -> SchemaInfo:
    """获取数据库 Schema 信息"""
    url = get_database_url(db_type, host, port, database, username, password)
    engine = create_async_engine(url, echo=False)

    tables = []

    try:
        async with engine.connect() as conn:
            # 获取表列表
            if db_type == "mysql":
                tables_result = await conn.execute(
                    text("""
                        SELECT TABLE_NAME, TABLE_COMMENT
                        FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA = :db
                    """),
                    {"db": database}
                )
                table_rows = tables_result.fetchall()

                for row in table_rows:
                    table_name = row[0]
                    table_comment = row[1]

                    # 获取列信息
                    columns_result = await conn.execute(
                        text("""
                            SELECT
                                COLUMN_NAME,
                                COLUMN_TYPE,
                                IS_NULLABLE,
                                COLUMN_KEY,
                                COLUMN_DEFAULT,
                                COLUMN_COMMENT
                            FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table
                            ORDER BY ORDINAL_POSITION
                        """),
                        {"db": database, "table": table_name}
                    )
                    column_rows = columns_result.fetchall()

                    columns = []
                    primary_keys = []

                    for col in column_rows:
                        col_name = col[0]
                        col_type = col[1]
                        nullable = col[2] == "YES"
                        col_key = col[3]
                        col_default = col[4]
                        col_comment = col[5]

                        if col_key == "PRI":
                            primary_keys.append(col_name)

                        columns.append(ColumnInfo(
                            name=col_name,
                            type=col_type,
                            nullable=nullable,
                            key=col_key if col_key else None,
                            default=col_default,
                            comment=col_comment if col_comment else None,
                        ))

                    tables.append(TableInfo(
                        name=table_name,
                        comment=table_comment if table_comment else None,
                        columns=columns,
                        primary_keys=primary_keys,
                        foreign_keys=[],
                    ))

            elif db_type == "postgresql":
                # PostgreSQL schema 查询
                schema = schema_name or "public"

                tables_result = await conn.execute(
                    text("""
                        SELECT table_name, obj_description((table_schema || '.' || table_name)::regclass) as table_comment
                        FROM information_schema.tables
                        WHERE table_schema = :schema AND table_type = 'BASE TABLE'
                    """),
                    {"schema": schema}
                )
                table_rows = tables_result.fetchall()

                for row in table_rows:
                    table_name = row[0]
                    table_comment = row[1]

                    columns_result = await conn.execute(
                        text("""
                            SELECT
                                column_name,
                                data_type || COALESCE('(' || character_maximum_length || ')', ''),
                                is_nullable,
                                NULL as column_key,
                                column_default,
                                col_description((table_schema || '.' || table_name)::regclass, ordinal_position)
                            FROM information_schema.columns
                            WHERE table_schema = :schema AND table_name = :table
                            ORDER BY ordinal_position
                        """),
                        {"schema": schema, "table": table_name}
                    )
                    column_rows = columns_result.fetchall()

                    columns = []
                    for col in column_rows:
                        columns.append(ColumnInfo(
                            name=col[0],
                            type=col[1],
                            nullable=col[2] == "YES",
                            key=col[3],
                            default=col[4],
                            comment=col[5],
                        ))

                    tables.append(TableInfo(
                        name=table_name,
                        comment=table_comment,
                        columns=columns,
                        primary_keys=[],
                        foreign_keys=[],
                    ))

            elif db_type == "sqlite":
                # SQLite schema 查询
                tables_result = await conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                )
                table_rows = tables_result.fetchall()

                for row in table_rows:
                    table_name = row[0]

                    # 获取表结构
                    pragma_result = await conn.execute(
                        text(f"PRAGMA table_info({table_name})")
                    )
                    column_rows = pragma_result.fetchall()

                    columns = []
                    primary_keys = []

                    for col in column_rows:
                        col_name = col[1]
                        col_type = col[2]
                        nullable = col[3] == 0  # notnull
                        col_default = col[4]
                        is_pk = col[5] == 1

                        if is_pk:
                            primary_keys.append(col_name)

                        columns.append(ColumnInfo(
                            name=col_name,
                            type=col_type,
                            nullable=not nullable,
                            key="PRI" if is_pk else None,
                            default=col_default,
                            comment=None,
                        ))

                    tables.append(TableInfo(
                        name=table_name,
                        comment=None,
                        columns=columns,
                        primary_keys=primary_keys,
                        foreign_keys=[],
                    ))

    finally:
        await engine.dispose()

    return SchemaInfo(
        database=database,
        tables=tables,
        loaded_at=datetime.utcnow(),
    )


async def execute_query(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    sql: str,
    max_rows: int = None,
    timeout: int = None,
) -> dict:
    """执行 SQL 查询"""
    max_rows = max_rows or settings.max_result_rows
    timeout = timeout or settings.query_timeout

    # 安全检查：只允许 SELECT 语句
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        return {
            "success": False,
            "error": "只允许执行 SELECT 查询",
            "code": "FORBIDDEN",
        }

    url = get_database_url(db_type, host, port, database, username, password)
    engine = create_async_engine(url, echo=False)

    try:
        async with engine.connect() as conn:
            # 设置查询超时
            if db_type == "mysql":
                await conn.execute(text(f"SET SESSION max_execution_time = {timeout * 1000}"))
            elif db_type == "postgresql":
                await conn.execute(text(f"SET statement_timeout = '{timeout}s'"))

            # 执行查询
            result = await conn.execute(text(sql))

            # 获取列名
            columns = list(result.keys()) if result.returns_rows else []

            # 获取数据
            rows = []
            truncated = False
            count = 0

            if result.returns_rows:
                for row in result:
                    if count >= max_rows:
                        truncated = True
                        break
                    rows.append(list(row))
                    count += 1

            return {
                "success": True,
                "columns": columns,
                "rows": rows,
                "total": len(rows),
                "truncated": truncated,
            }

    except asyncio.TimeoutError:
        return {
            "success": False,
            "error": f"查询超时（超过 {timeout} 秒）",
            "code": "TIMEOUT",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "code": "ERROR",
        }
    finally:
        await engine.dispose()