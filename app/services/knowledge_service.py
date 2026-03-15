"""知识库服务 - 文件存储与处理"""

import os
import uuid
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.models import KnowledgeFile

# 知识库根目录
KNOWLEDGE_BASE_DIR = Path("data/knowledge")
ALLOWED_EXTENSIONS = {".txt", ".md", ".docx", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class KnowledgeService:
    """知识库服务类"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _get_knowledge_dir(self, datasource_id: str = None) -> Path:
        """获取知识库目录路径"""
        if datasource_id:
            return KNOWLEDGE_BASE_DIR / datasource_id
        return KNOWLEDGE_BASE_DIR / "global"

    def _ensure_dir(self, path: Path):
        """确保目录存在"""
        path.mkdir(parents=True, exist_ok=True)

    async def upload_file(
        self,
        datasource_id: str,
        filename: str,
        content: bytes,
        category: str = "raw",
        sub_category: str = None,
        title: str = None,
        description: str = None,
        tags: List[str] = None,
    ) -> KnowledgeFile:
        """上传知识文件

        Args:
            datasource_id: 数据源ID（None表示全局知识）
            filename: 文件名
            content: 文件内容
            category: 类别 raw/curated
            sub_category: 子类别
            title: 标题
            description: 描述
            tags: 标签列表

        Returns:
            KnowledgeFile 实例
        """
        file_id = str(uuid.uuid4())
        file_ext = Path(filename).suffix.lower()

        if file_ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的文件格式: {file_ext}")

        if len(content) > MAX_FILE_SIZE:
            raise ValueError(f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）")

        # 确定存储目录
        base_dir = self._get_knowledge_dir(datasource_id)

        # 保存原始文件
        raw_dir = base_dir / "raw"
        self._ensure_dir(raw_dir)

        # 处理重名文件
        raw_filename = filename
        counter = 1
        while (raw_dir / raw_filename).exists():
            stem = Path(filename).stem
            raw_filename = f"{stem}_{counter}{file_ext}"
            counter += 1

        raw_path = raw_dir / raw_filename
        raw_path.write_bytes(content)

        # 转换为文本
        text_content = await self._convert_to_text(content, file_ext)

        # 保存处理后的文本（使用原始文件名，方便智能体识别）
        processed_dir = base_dir / "processed"
        self._ensure_dir(processed_dir)

        # 处理重名文件
        processed_filename = raw_filename
        if not processed_filename.endswith('.txt'):
            processed_filename = Path(raw_filename).stem + '.txt'
        counter = 1
        while (processed_dir / processed_filename).exists():
            stem = Path(raw_filename).stem
            processed_filename = f"{stem}_{counter}.txt"
            counter += 1

        processed_path = processed_dir / processed_filename
        processed_path.write_text(text_content, encoding="utf-8")

        # 自动提取摘要和表名
        auto_summary = text_content[:500] + "..." if len(text_content) > 500 else text_content
        mentioned_tables = self._extract_table_names(text_content)

        # 创建数据库记录
        knowledge_file = KnowledgeFile(
            id=file_id,
            datasource_id=datasource_id,
            filename=raw_filename,
            file_type=file_ext,
            category=category,
            sub_category=sub_category,
            raw_path=str(raw_path),
            processed_path=str(processed_path),
            title=title or Path(filename).stem,
            description=description,
            tags=tags or [],
            auto_summary=auto_summary,
            mentioned_tables=mentioned_tables,
            file_size=len(content),
            use_count=0,
        )

        self.db.add(knowledge_file)
        await self.db.flush()

        return knowledge_file

    async def _convert_to_text(self, content: bytes, file_ext: str) -> str:
        """将文件转换为文本"""
        if file_ext in [".txt", ".md"]:
            return content.decode("utf-8", errors="ignore")

        elif file_ext == ".docx":
            try:
                from docx import Document
                import io
                doc = Document(io.BytesIO(content))
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                return "\n\n".join(paragraphs)
            except ImportError:
                return "[无法解析 Word 文档，请安装 python-docx]"

        elif file_ext == ".pdf":
            try:
                import pdfplumber
                import io
                text_parts = []
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append(page_text)
                return "\n\n".join(text_parts)
            except ImportError:
                return "[无法解析 PDF 文档，请安装 pdfplumber]"

        return f"[不支持的文件格式: {file_ext}]"

    def _extract_table_names(self, text: str) -> List[str]:
        """从文本中提取表名（简单规则匹配）"""
        import re

        tables = []

        # 匹配常见模式
        patterns = [
            r'表[：:]\s*`?(\w+)`?',
            r'table[：:]\s*`?(\w+)`?',
            r'FROM\s+(\w+)',
            r'JOIN\s+(\w+)',
            r'表名[：:]\s*`?(\w+)`?',
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            tables.extend(matches)

        # 去重并过滤
        tables = list(set(t.lower() for t in tables if len(t) > 2 and t.isalnum()))
        return tables[:10]  # 最多返回10个

    async def list_files(
        self,
        datasource_id: str = None,
        category: str = None,
        sub_category: str = None,
        limit: int = 50,
    ) -> List[KnowledgeFile]:
        """列出知识文件"""
        query = select(KnowledgeFile)

        if datasource_id:
            query = query.where(KnowledgeFile.datasource_id == datasource_id)
        else:
            query = query.where(KnowledgeFile.datasource_id.is_(None))

        if category:
            query = query.where(KnowledgeFile.category == category)

        if sub_category:
            query = query.where(KnowledgeFile.sub_category == sub_category)

        query = query.order_by(KnowledgeFile.created_at.desc()).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_file(self, file_id: str) -> Optional[KnowledgeFile]:
        """获取文件信息"""
        result = await self.db.execute(
            select(KnowledgeFile).where(KnowledgeFile.id == file_id)
        )
        return result.scalar_one_or_none()

    async def get_file_content(self, file_id: str) -> Optional[str]:
        """获取文件内容"""
        knowledge_file = await self.get_file(file_id)
        if not knowledge_file:
            return None

        # 读取处理后的文本
        processed_path = Path(knowledge_file.processed_path)
        if processed_path.exists():
            content = processed_path.read_text(encoding="utf-8")
            # 更新使用计数
            knowledge_file.use_count += 1
            await self.db.flush()
            return content

        return None

    async def delete_file(self, file_id: str) -> bool:
        """删除文件"""
        knowledge_file = await self.get_file(file_id)
        if not knowledge_file:
            return False

        # 删除文件
        if knowledge_file.raw_path:
            raw_path = Path(knowledge_file.raw_path)
            if raw_path.exists():
                raw_path.unlink()

        if knowledge_file.processed_path:
            processed_path = Path(knowledge_file.processed_path)
            if processed_path.exists():
                processed_path.unlink()

        # 删除数据库记录
        await self.db.delete(knowledge_file)
        await self.db.flush()

        return True

    async def search_files(
        self,
        datasource_id: str,
        query: str,
        limit: int = 10,
    ) -> List[dict]:
        """搜索知识文件（使用 grep）"""
        base_dir = self._get_knowledge_dir(datasource_id)
        processed_dir = base_dir / "processed"

        if not processed_dir.exists():
            return []

        results = []

        try:
            # 使用 grep 搜索
            cmd = f'grep -ril "{query}" {processed_dir}'
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=10,
            )

            matching_files = result.stdout.strip().split("\n")[:limit]

            for file_path in matching_files:
                if not file_path:
                    continue

                # 获取文件 ID
                file_id = Path(file_path).stem

                # 从数据库获取信息
                knowledge_file = await self.get_file(file_id)
                if knowledge_file:
                    # 获取匹配的上下文
                    context = self._get_match_context(file_path, query)
                    results.append({
                        "id": knowledge_file.id,
                        "filename": knowledge_file.filename,
                        "title": knowledge_file.title,
                        "category": knowledge_file.category,
                        "sub_category": knowledge_file.sub_category,
                        "context": context,
                        "use_count": knowledge_file.use_count,
                    })

        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            print(f"[KnowledgeService] 搜索失败: {e}")

        return results

    def _get_match_context(self, file_path: str, query: str, context_chars: int = 200) -> str:
        """获取匹配上下文"""
        try:
            cmd = f'grep -i -B 2 -A 2 "{query}" {file_path} | head -20'
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.stdout.strip()[:context_chars * 2]
        except:
            return ""

    def explore_knowledge(
        self,
        datasource_id: str,
        command: str,
    ) -> str:
        """探索知识库（执行 shell 命令）"""
        base_dir = self._get_knowledge_dir(datasource_id)
        processed_dir = base_dir / "processed"

        if not processed_dir.exists():
            return "知识库为空"

        # 允许的命令
        allowed_commands = ["grep", "find", "cat", "ls", "head", "tail", "wc"]

        cmd_parts = command.split()
        if not cmd_parts or cmd_parts[0] not in allowed_commands:
            return f"错误：只允许使用以下命令：{', '.join(allowed_commands)}"

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(processed_dir),
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

    def list_knowledge_structure(self, datasource_id: str) -> str:
        """列出知识库结构"""
        base_dir = self._get_knowledge_dir(datasource_id)

        if not base_dir.exists():
            return "知识库为空，请先上传知识文件"

        lines = ["# 知识库文件列表\n"]

        # 列出原始文件
        raw_dir = base_dir / "raw"
        if raw_dir.exists():
            files = [f for f in raw_dir.iterdir() if not f.name.startswith('.')]
            if files:
                lines.append("## 📄 原始文档\n")
                for f in sorted(files):
                    lines.append(f"- `{f.name}`")

        # 列出精选知识
        curated_dir = base_dir / "curated"
        if curated_dir.exists():
            sub_dirs = [d for d in curated_dir.iterdir() if d.is_dir()]
            if sub_dirs:
                lines.append("\n## ✨ 精选知识\n")
                for sub_dir in sorted(sub_dirs):
                    files = list(sub_dir.glob("*.md"))
                    if files:
                        lines.append(f"\n### {sub_dir.name}/")
                        for f in sorted(files):
                            lines.append(f"  - {f.stem}")

        return "\n".join(lines)