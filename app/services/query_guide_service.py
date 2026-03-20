"""查询指南服务 - 文档存储与探索"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List
import subprocess

from sqlalchemy.ext.asyncio import AsyncSession

# 查询指南根目录
QUERY_GUIDE_BASE_DIR = Path("data/query_guides")
ALLOWED_EXTENSIONS = {".txt", ".md", ".docx", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class QueryGuideService:
    """查询指南服务类"""

    def __init__(self, db: AsyncSession = None):
        self.db = db

    def _get_guide_dir(self, datasource_id: str) -> Path:
        """获取查询指南目录"""
        return QUERY_GUIDE_BASE_DIR / datasource_id

    def _get_uploaded_dir(self, datasource_id: str) -> Path:
        """获取上传文档目录"""
        return self._get_guide_dir(datasource_id) / "uploaded"

    def _get_notes_path(self, datasource_id: str) -> Path:
        """获取备注文件路径"""
        return self._get_guide_dir(datasource_id) / "notes.md"

    def _ensure_dir(self, path: Path):
        """确保目录存在"""
        path.mkdir(parents=True, exist_ok=True)

    async def get_guide_content(self, datasource_id: str) -> dict:
        """获取查询指南内容"""
        uploaded_dir = self._get_uploaded_dir(datasource_id)
        notes_path = self._get_notes_path(datasource_id)

        # 获取已上传文件列表
        files = []
        if uploaded_dir.exists():
            for f in uploaded_dir.iterdir():
                if not f.name.startswith('.'):
                    files.append({
                        "filename": f.name,
                        "size": f.stat().st_size,
                        "updated_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                    })

        # 获取备注内容
        notes = ""
        if notes_path.exists():
            notes = notes_path.read_text(encoding="utf-8")

        return {
            "files": sorted(files, key=lambda x: x["filename"]),
            "notes": notes,
        }

    async def update_notes(self, datasource_id: str, notes: str):
        """更新备注内容"""
        guide_dir = self._get_guide_dir(datasource_id)
        self._ensure_dir(guide_dir)

        notes_path = self._get_notes_path(datasource_id)
        notes_path.write_text(notes, encoding="utf-8")

    async def upload_file(
        self,
        datasource_id: str,
        filename: str,
        content: bytes,
    ) -> dict:
        """上传文档"""
        file_ext = Path(filename).suffix.lower()

        if file_ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的文件格式: {file_ext}")

        if len(content) > MAX_FILE_SIZE:
            raise ValueError(f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）")

        uploaded_dir = self._get_uploaded_dir(datasource_id)
        self._ensure_dir(uploaded_dir)

        # 处理重名文件
        raw_filename = filename
        counter = 1
        while (uploaded_dir / raw_filename).exists():
            stem = Path(filename).stem
            raw_filename = f"{stem}_{counter}{file_ext}"
            counter += 1

        file_path = uploaded_dir / raw_filename
        file_path.write_bytes(content)

        return {
            "filename": raw_filename,
            "size": len(content),
        }

    async def delete_file(self, datasource_id: str, filename: str) -> bool:
        """删除文档"""
        uploaded_dir = self._get_uploaded_dir(datasource_id)
        file_path = uploaded_dir / filename

        if file_path.exists() and file_path.is_file():
            file_path.unlink()
            return True
        return False

    def explore_guide(self, datasource_id: str, command: str) -> str:
        """探索查询指南（执行 shell 命令）"""
        guide_dir = self._get_guide_dir(datasource_id)

        if not guide_dir.exists():
            return "查询指南为空，请先上传文档或添加备注"

        # 允许的命令
        allowed_commands = ["grep", "find", "cat", "ls", "head", "tail", "wc"]

        cmd_parts = command.split()
        if not cmd_parts or cmd_parts[0] not in allowed_commands:
            return f"错误：只允许使用以下命令：{', '.join(allowed_commands)}"

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(guide_dir),
                capture_output=True,
                text=True,
                timeout=10,
            )

            output = result.stdout or result.stderr

            if len(output) > 10000:
                output = output[:10000] + "\n\n... [输出已截断]"

            return output or "(无输出)"

        except subprocess.TimeoutExpired:
            return "错误：命令执行超时"
        except Exception as e:
            return f"错误：{str(e)}"

    def list_guide_structure(self, datasource_id: str) -> str:
        """列出查询指南结构"""
        guide_dir = self._get_guide_dir(datasource_id)
        uploaded_dir = self._get_uploaded_dir(datasource_id)

        if not guide_dir.exists():
            return "查询指南为空"

        lines = ["# 查询指南文件列表\n"]

        # 列出备注
        notes_path = self._get_notes_path(datasource_id)
        if notes_path.exists():
            lines.append("## 📝 备注说明\n")
            lines.append("- `notes.md` (手动编辑)\n")

        # 列出上传的文档
        if uploaded_dir.exists():
            files = [f for f in uploaded_dir.iterdir() if not f.name.startswith('.')]
            if files:
                lines.append("\n## 📄 上传文档\n")
                for f in sorted(files):
                    lines.append(f"- `{f.name}`")
            else:
                lines.append("\n## 📄 上传文档\n")
                lines.append("(空)\n")

        return "\n".join(lines)

    async def cleanup_guide_files(self, datasource_id: str):
        """清理数据源的查询指南文件"""
        import shutil
        guide_dir = self._get_guide_dir(datasource_id)
        if guide_dir.exists():
            shutil.rmtree(guide_dir)