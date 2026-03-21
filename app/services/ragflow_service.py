"""RAGFLOW 知识库服务"""

import httpx
import logging
import json
from typing import Optional, List, Dict, Any
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RagflowService:
    """RAGFLOW 知识库检索服务"""

    def __init__(self):
        self.api_base = settings.ragflow_api_base.rstrip("/")
        self.api_key = settings.ragflow_api_key
        self.kb_id = settings.ragflow_knowledge_base_id
        self.top_k = settings.ragflow_top_k
        self.score_threshold = settings.ragflow_score_threshold
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """获取异步 HTTP 客户端"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.api_base,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=httpx.Timeout(30.0),
            )
        return self._client

    async def search(
        self,
        query: str,
        top_k: Optional[int] = None,
        score_threshold: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        在 RAGFLOW 知识库中检索

        Args:
            query: 搜索查询
            top_k: 返回的片段数量（默认使用配置值）
            score_threshold: 最低相似度阈值（默认使用配置值）

        Returns:
            检索结果，包含 chunks 列表
        """
        if not self.kb_id:
            return {
                "success": False,
                "error": "未配置 RAGFLOW 知识库 ID，请在环境变量中设置 RAGFLOW_KNOWLEDGE_BASE_ID",
            }

        try:
            client = await self._get_client()

            # 根据 RAGFlow 0.19.1 API，使用检索 API
            response = await client.request(
                "POST",
                "/api/v1/retrieval",
                content=json.dumps({
                    "dataset_ids": [self.kb_id],
                    "question": query,
                    "top_k": top_k or self.top_k,
                    "similarity_threshold": score_threshold or self.score_threshold,
                }),
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    chunks = data.get("data", {}).get("chunks", [])
                    return {
                        "success": True,
                        "chunks": chunks,
                        "query": query,
                    }
                else:
                    return {
                        "success": False,
                        "error": f"RAGFLOW API 错误：{data.get('message', '未知错误')}",
                    }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                }

        except httpx.TimeoutException:
            return {"success": False, "error": "RAGFLOW API 请求超时"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"RAGFLOW 连接失败：{str(e)}"}
        except Exception as e:
            logger.exception(f"RAGFLOW 检索异常：{e}")
            return {"success": False, "error": f"RAGFLOW 检索失败：{str(e)}"}

    async def close(self):
        """关闭 HTTP 客户端"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ==================== 知识库文件管理方法 ====================

    async def list_files(self) -> Dict[str, Any]:
        """
        获取知识库文件列表

        Returns:
            文件列表，包含 documents 数组
        """
        if not self.kb_id:
            return {
                "success": False,
                "error": "未配置 RAGFLOW 知识库 ID，请在环境变量中设置 RAGFLOW_KNOWLEDGE_BASE_ID",
            }

        try:
            client = await self._get_client()

            # 根据 RAGFlow API 文档，使用 datasets API
            response = await client.get(
                f"/api/v1/datasets/{self.kb_id}/documents?page=1&page_size=100"
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"RAGFLOW API 返回数据：{data}")
                if data.get("code") == 0:
                    # API 返回的是 docs 数组
                    docs = data.get("data", {}).get("docs", [])
                    logger.info(f"获取到 {len(docs)} 个文档")
                    return {"success": True, "documents": docs}
                else:
                    return {
                        "success": False,
                        "error": f"RAGFLOW API 错误：{data.get('message', '未知错误')}",
                    }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                }

        except httpx.TimeoutException:
            return {"success": False, "error": "RAGFLOW API 请求超时"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"RAGFLOW 连接失败：{str(e)}"}
        except Exception as e:
            logger.exception(f"RAGFLOW 获取文件列表异常：{e}")
            return {"success": False, "error": "RAGFLOW 获取文件列表失败：{str(e)}"}

    async def upload_file(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        上传文件到知识库

        Args:
            file_content: 文件二进制内容
            filename: 文件名

        Returns:
            上传结果，包含文件 id 和 name
        """
        if not self.kb_id:
            return {
                "success": False,
                "error": "未配置 RAGFLOW 知识库 ID，请在环境变量中设置 RAGFLOW_KNOWLEDGE_BASE_ID",
            }

        try:
            client = await self._get_client()

            # 根据 RAGFlow API 文档，使用 datasets/{dataset_id}/documents/upload
            files = {"file": (filename, file_content)}
            response = await client.post(
                f"/api/v1/datasets/{self.kb_id}/documents",
                files=files,
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    # 返回的是数组，取第一个
                    result = data.get("data", [])[0] if data.get("data") else {}
                    return {
                        "success": True,
                        "doc_id": result.get("id"),
                        "name": result.get("name"),
                        "status": result.get("run", "UNSTART"),
                    }
                else:
                    return {
                        "success": False,
                        "error": f"RAGFLOW API 错误：{data.get('message', '未知错误')}",
                    }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                }

        except httpx.TimeoutException:
            return {"success": False, "error": "RAGFLOW API 请求超时"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"RAGFLOW 连接失败：{str(e)}"}
        except Exception as e:
            logger.exception(f"RAGFLOW 上传文件异常：{e}")
            return {"success": False, "error": f"RAGFLOW 上传文件失败：{str(e)}"}

    async def get_file_status(self, doc_id: str) -> Dict[str, Any]:
        """
        获取文件解析状态和进度

        Args:
            doc_id: 文件 ID

        Returns:
            文件状态信息，包含 status、progress、chunk_count 等
        """
        if not self.kb_id:
            return {
                "success": False,
                "error": "未配置 RAGFLOW 知识库 ID，请在环境变量中设置 RAGFLOW_KNOWLEDGE_BASE_ID",
            }

        try:
            client = await self._get_client()

            # 根据 RAGFlow API 文档，从 list API 获取文档列表，然后查找指定 ID 的文档
            response = await client.get(
                f"/api/v1/datasets/{self.kb_id}/documents?page=1&page_size=100&id={doc_id}"
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    docs = data.get("data", {}).get("docs", [])
                    if docs:
                        file_info = docs[0]
                        return {
                            "success": True,
                            "data": {
                                "doc_id": file_info.get("id"),
                                "name": file_info.get("name"),
                                "status": file_info.get("run"),  # UNSTART, RUNNING, DONE, FAIL
                                "progress": file_info.get("progress", 0),
                                "chunk_count": file_info.get("chunk_count", 0),
                                "created_at": file_info.get("create_date"),
                            }
                        }
                    else:
                        return {
                            "success": False,
                            "error": "文件不存在",
                        }
                else:
                    return {
                        "success": False,
                        "error": f"RAGFLOW API 错误：{data.get('message', '未知错误')}",
                    }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                }

        except httpx.TimeoutException:
            return {"success": False, "error": "RAGFLOW API 请求超时"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"RAGFLOW 连接失败：{str(e)}"}
        except Exception as e:
            logger.exception(f"RAGFLOW 获取文件状态异常：{e}")
            return {"success": False, "error": f"RAGFLOW 获取文件状态失败：{str(e)}"}

    async def delete_file(self, doc_id: str) -> Dict[str, Any]:
        """
        删除知识库文件

        Args:
            doc_id: 文件 ID

        Returns:
            删除结果
        """
        if not self.kb_id:
            return {
                "success": False,
                "error": "未配置 RAGFLOW 知识库 ID，请在环境变量中设置 RAGFLOW_KNOWLEDGE_BASE_ID",
            }

        try:
            client = await self._get_client()

            # 根据 RAGFlow API 文档，使用 DELETE /api/v1/datasets/{dataset_id}/documents
            # 需要传递 ids 数组
            response = await client.request(
                "DELETE",
                f"/api/v1/datasets/{self.kb_id}/documents",
                content=json.dumps({"ids": [doc_id]}),
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    return {"success": True, "message": "删除成功"}
                else:
                    return {
                        "success": False,
                        "error": f"RAGFLOW API 错误：{data.get('message', '未知错误')}",
                    }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                }

        except httpx.TimeoutException:
            return {"success": False, "error": "RAGFLOW API 请求超时"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"RAGFLOW 连接失败：{str(e)}"}
        except Exception as e:
            logger.exception(f"RAGFLOW 删除文件异常：{e}")
            return {"success": False, "error": f"RAGFLOW 删除文件失败：{str(e)}"}

    async def parse_file(self, doc_ids: List[str]) -> Dict[str, Any]:
        """
        触发文件解析

        Args:
            doc_ids: 文件 ID 列表

        Returns:
            解析结果
        """
        if not self.kb_id:
            return {
                "success": False,
                "error": "未配置 RAGFLOW 知识库 ID，请在环境变量中设置 RAGFLOW_KNOWLEDGE_BASE_ID",
            }

        if not doc_ids:
            return {"success": False, "error": "文件 ID 列表不能为空"}

        try:
            client = await self._get_client()

            # 根据 RAGFlow API 文档，body 是 {"document_ids": [...]} 格式
            response = await client.request(
                "POST",
                f"/api/v1/datasets/{self.kb_id}/chunks",
                content=json.dumps({"document_ids": doc_ids}),
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    return {"success": True, "message": "解析任务已提交"}
                else:
                    return {
                        "success": False,
                        "error": f"RAGFLOW API 错误：{data.get('message', '未知错误')}",
                    }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                }

        except httpx.TimeoutException:
            return {"success": False, "error": "RAGFLOW API 请求超时"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"RAGFLOW 连接失败：{str(e)}"}
        except Exception as e:
            logger.exception(f"RAGFLOW 解析文件异常：{e}")
            return {"success": False, "error": f"RAGFLOW 解析文件失败：{str(e)}"}

    def format_results(self, search_result: dict, top_k: Optional[int] = None) -> str:
        """
        格式化检索结果为文本

        Args:
            search_result: search() 方法返回的结果
            top_k: 最大返回条数（用于截断）

        Returns:
            格式化的文本，适合发送给 LLM
        """
        if not search_result.get("success"):
            return f"检索失败：{search_result.get('error', '未知错误')}"

        chunks = search_result.get("chunks", [])
        if not chunks:
            return "未在知识库中找到相关内容"

        # 如果指定了 top_k，手动截断结果
        if top_k and len(chunks) > top_k:
            chunks = chunks[:top_k]

        lines = [f"# 知识库检索结果（查询：{search_result.get('query', '')}）\n"]
        lines.append(f"找到 {len(chunks)} 条相关内容:\n")

        for i, chunk in enumerate(chunks, 1):
            content = chunk.get("content", "")
            # RAGFLOW 可能返回 similarity 或 score 字段，值域可能是 0-1 或 0-100
            score = chunk.get("similarity") or chunk.get("score") or 0
            doc_name = chunk.get("document_name") or chunk.get("doc_name") or "未知文档"

            # 如果 score 大于 1，假设是百分比格式（0-100），否则假设是 0-1 格式
            if score > 1:
                lines.append(f"### 相关内容 {i} (相似度：{score:.1f}%)")
            else:
                lines.append(f"### 相关内容 {i} (相似度：{score:.2%})")
            lines.append(f"**来源**: {doc_name}\n")
            lines.append(content)
            lines.append("")

        return "\n".join(lines)


# 单例
_ragflow_service: Optional[RagflowService] = None


def get_ragflow_service() -> RagflowService:
    """获取 RagflowService 单例"""
    global _ragflow_service
    if _ragflow_service is None:
        _ragflow_service = RagflowService()
    return _ragflow_service
