"""文件数据源服务 - CSV/Excel 文件上传与智能转换"""

import os
import uuid
import json
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

# 文件存储根目录
FILE_BASE_DIR = Path("data/files")
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


class FileDatasourceService:
    """文件数据源服务类"""

    def __init__(self, db: AsyncSession = None):
        self.db = db

    def _ensure_dir(self, path: Path):
        """确保目录存在"""
        path.mkdir(parents=True, exist_ok=True)

    def _get_datasource_dir(self, datasource_id: str) -> Path:
        """获取数据源文件目录"""
        return FILE_BASE_DIR / datasource_id

    async def validate_file(self, file: UploadFile) -> dict:
        """验证上传文件

        Returns:
            验证结果，包含 success、message、file_ext 等
        """
        filename = file.filename or ""
        file_ext = Path(filename).suffix.lower()

        if file_ext not in ALLOWED_EXTENSIONS:
            return {
                "success": False,
                "message": f"不支持的文件格式: {file_ext}，支持: CSV、XLSX、XLS",
            }

        return {
            "success": True,
            "file_ext": file_ext,
            "filename": filename,
        }

    async def save_file(
        self,
        datasource_id: str,
        file: UploadFile,
    ) -> tuple[str, str]:
        """保存上传文件

        Args:
            datasource_id: 数据源 ID
            file: 上传的文件

        Returns:
            (原始文件路径, 文件扩展名)
        """
        file_ext = Path(file.filename or "").suffix.lower()

        # 确保目录存在
        base_dir = self._get_datasource_dir(datasource_id)
        self._ensure_dir(base_dir)

        # 保存原始文件
        raw_filename = file.filename or f"upload{file_ext}"
        raw_path = base_dir / raw_filename

        # 处理重名文件
        counter = 1
        while raw_path.exists():
            stem = Path(file.filename or "upload").stem
            raw_filename = f"{stem}_{counter}{file_ext}"
            raw_path = base_dir / raw_filename
            counter += 1

        # 写入文件
        content = await file.read()
        raw_path.write_bytes(content)

        return str(raw_path), file_ext

    async def preview_file(
        self,
        file_path: str,
        rows: int = 20,
    ) -> dict:
        """预览文件内容

        Args:
            file_path: 文件路径
            rows: 预览行数

        Returns:
            预览结果，包含 data、columns、total_rows 等
        """
        import pandas as pd

        try:
            file_ext = Path(file_path).suffix.lower()

            # 读取文件
            if file_ext == ".csv":
                # 尝试不同编码
                for encoding in ["utf-8", "gbk", "gb2312", "latin-1"]:
                    try:
                        df = pd.read_csv(file_path, encoding=encoding, nrows=rows)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    return {"success": False, "error": "无法识别文件编码"}
            elif file_ext in [".xlsx", ".xls"]:
                df = pd.read_excel(file_path, nrows=rows)
            else:
                return {"success": False, "error": f"不支持的文件格式: {file_ext}"}

            # 转换为预览数据
            # 替换 NaN 为 None
            df = df.where(pd.notna(df), None)

            columns = list(df.columns)
            data = df.values.tolist()

            # 获取总行数
            if file_ext == ".csv":
                total_rows = sum(1 for _ in open(file_path, "rb")) - 1
            else:
                total_rows = len(pd.read_excel(file_path))

            return {
                "success": True,
                "columns": columns,
                "data": data,
                "total_rows": total_rows,
                "preview_rows": len(data),
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_duckdb_connection(self, datasource_id: str):
        """获取 DuckDB 连接，加载该数据源的所有文件

        Args:
            datasource_id: 数据源 ID

        Returns:
            DuckDB 连接
        """
        import duckdb

        base_dir = self._get_datasource_dir(datasource_id)

        # 创建内存连接
        conn = duckdb.connect(":memory:")

        # 查找所有支持的文件
        csv_files = list(base_dir.glob("*.csv"))
        excel_files = list(base_dir.glob("*.xlsx")) + list(base_dir.glob("*.xls"))

        # 加载 CSV 文件
        for csv_file in csv_files:
            table_name = csv_file.stem
            # 清理表名
            import re
            table_name = re.sub(r'[^\w]', '_', table_name)
            table_name = re.sub(r'_+', '_', table_name).strip('_')

            # 创建表（DuckDB 可以直接读取 CSV）
            conn.execute(f"CREATE TABLE IF NOT EXISTS {table_name} AS SELECT * FROM read_csv_auto('{csv_file}')")

        # 加载 Excel 文件
        for excel_file in excel_files:
            table_name = excel_file.stem
            # 清理表名
            import re
            table_name = re.sub(r'[^\w]', '_', table_name)
            table_name = re.sub(r'_+', '_', table_name).strip('_')

            # DuckDB 可以通过 spatial 扩展读取 Excel，但需要安装
            # 这里我们使用 pandas 作为中间层
            import pandas as pd
            df = pd.read_excel(excel_file)
            df = df.where(pd.notna(df), None)
            conn.execute(f"CREATE TABLE IF NOT EXISTS {table_name} AS SELECT * FROM df")

        return conn

    async def get_tables_info(self, datasource_id: str) -> List[dict]:
        """获取数据源中所有表的信息

        Args:
            datasource_id: 数据源 ID

        Returns:
            表信息列表
        """
        import duckdb

        base_dir = self._get_datasource_dir(datasource_id)
        if not base_dir.exists():
            return []

        conn = self.get_duckdb_connection(datasource_id)

        try:
            # 获取所有表
            tables_result = conn.execute("SHOW TABLES").fetchall()
            tables = []

            for row in tables_result:
                table_name = row[0]

                # 获取列信息
                columns_result = conn.execute(f"DESCRIBE {table_name}").fetchall()
                columns = []
                for col in columns_result:
                    columns.append({
                        "name": col[0],
                        "type": col[1],
                        "nullable": col[2] == "YES" if len(col) > 2 else True,
                    })

                # 获取行数
                row_count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]

                tables.append({
                    "name": table_name,
                    "columns": columns,
                    "row_count": row_count,
                })

            return tables

        finally:
            conn.close()

    async def execute_query(
        self,
        datasource_id: str,
        sql: str,
        max_rows: int = 1000,
    ) -> dict:
        """执行 DuckDB 查询

        Args:
            datasource_id: 数据源 ID
            sql: SQL 查询语句
            max_rows: 最大返回行数

        Returns:
            查询结果
        """
        import duckdb

        # 安全检查：只允许 SELECT 语句
        sql_upper = sql.strip().upper()
        if not sql_upper.startswith("SELECT"):
            return {
                "success": False,
                "error": "只允许执行 SELECT 查询",
                "code": "FORBIDDEN",
            }

        conn = self.get_duckdb_connection(datasource_id)

        try:
            # 执行查询
            result = conn.execute(sql).fetchall()

            # 获取列名
            columns = [desc[0] for desc in conn.description]

            # 限制行数
            truncated = False
            if len(result) > max_rows:
                result = result[:max_rows]
                truncated = True

            return {
                "success": True,
                "columns": columns,
                "rows": [list(row) for row in result],
                "total": len(result),
                "truncated": truncated,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "code": "ERROR",
            }
        finally:
            conn.close()

    async def cleanup_datasource_files(self, datasource_id: str):
        """清理数据源的所有文件

        Args:
            datasource_id: 数据源 ID
        """
        import shutil

        base_dir = self._get_datasource_dir(datasource_id)
        if base_dir.exists():
            shutil.rmtree(base_dir)