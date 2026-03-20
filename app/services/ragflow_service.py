"""RAGFLOW 知识库服务"""

import httpx
import logging
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

            response = await client.post(
                f"/api/v1/knowledge_base/{self.kb_id}/chunks",
                json={
                    "query": query,
                    "top_k": top_k or self.top_k,
                    "score_threshold": score_threshold or self.score_threshold,
                },
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

    def format_results(self, search_result: dict) -> str:
        """
        格式化检索结果为文本

        Args:
            search_result: search() 方法返回的结果

        Returns:
            格式化的文本，适合发送给 LLM
        """
        if not search_result.get("success"):
            return f"检索失败：{search_result.get('error', '未知错误')}"

        chunks = search_result.get("chunks", [])
        if not chunks:
            return "未在知识库中找到相关内容"

        lines = [f"# 知识库检索结果（查询：{search_result.get('query', '')}）\n"]
        lines.append(f"找到 {len(chunks)} 条相关内容:\n")

        for i, chunk in enumerate(chunks, 1):
            content = chunk.get("content", "")
            score = chunk.get("score", 0)
            doc_name = chunk.get("document_name", "未知文档")

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
