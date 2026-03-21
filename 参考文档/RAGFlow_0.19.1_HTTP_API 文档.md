# RAGFlow 0.19.1 HTTP API 文档总结

> 文档版本：v0.19.1  
> 更新时间：2026-03-20  
> 官方文档：https://ragflow.io/docs/dev/

---

## 📋 目录

1. [API 概述](#api-概述)
2. [认证方式](#认证方式)
3. [核心 API 端点](#核心-api-端点)
4. [知识库管理](#知识库管理)
5. [文档管理](#文档管理)
6. [对话/问答 API](#对话问答-api)
7. [Agent/工作流](#agent工作流)
8. [模型配置](#模型配置)
9. [错误码](#错误码)
10. [使用示例](#使用示例)

---

## API 概述

RAGFlow 是一个开源的 RAG（检索增强生成）引擎，基于深度文档理解，提供 HTTP API 用于：
- 知识库管理
- 文档上传与解析
- 智能问答
- Agent 工作流编排

**默认服务地址**：`http://localhost:80`（可通过配置修改）

---

## 认证方式

### API Key 认证

在请求头中携带 API Key：

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### 获取 API Key

1. 登录 RAGFlow Web 界面
2. 进入用户设置
3. 生成/复制 API Key

---

## 核心 API 端点

### 基础端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/system/status` | GET | 获取系统状态 |
| `/api/v1/user/profile` | GET | 获取用户信息 |

---

## 知识库管理

### 创建知识库

```http
POST /api/v1/knowledgebase/create
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "name": "我的知识库",
  "description": "知识库描述",
  "language": "zh",
  "permission": "me",
  "chunk_method": "naive",
  "parser_config": {
    "chunk_token_num": 512,
    "delimiter": "\\n"
  }
}
```

### 知识库列表

```http
GET /api/v1/knowledgebase/list?page=1&page_size=15
Authorization: Bearer YOUR_API_KEY
```

### 获取知识库详情

```http
GET /api/v1/knowledgebase/{kb_id}
Authorization: Bearer YOUR_API_KEY
```

### 更新知识库

```http
PUT /api/v1/knowledgebase/{kb_id}
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "name": "更新后的名称",
  "description": "更新后的描述"
}
```

### 删除知识库

```http
DELETE /api/v1/knowledgebase/{kb_id}
Authorization: Bearer YOUR_API_KEY
```

---

## 文档管理

### 上传文档

```http
POST /api/v1/document/upload
Content-Type: multipart/form-data
Authorization: Bearer YOUR_API_KEY

FormData:
- file: [文件]
- kb_id: [知识库ID]
- parser_config: [解析配置，可选]
```

### 文档列表

```http
GET /api/v1/document/list?kb_id={kb_id}&page=1&page_size=15
Authorization: Bearer YOUR_API_KEY
```

### 文档解析状态

```http
GET /api/v1/document/{doc_id}/status
Authorization: Bearer YOUR_API_KEY
```

### 删除文档

```http
DELETE /api/v1/document/{doc_id}
Authorization: Bearer YOUR_API_KEY
```

### 文档分块管理

```http
GET /api/v1/document/{doc_id}/chunks
Authorization: Bearer YOUR_API_KEY

POST /api/v1/document/{doc_id}/chunk
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "content": "分块内容",
  "important_keywords": ["关键词1", "关键词2"]
}
```

---

## 对话/问答 API

### 简单问答

```http
POST /api/v1/chat/completion
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "knowledgebase_ids": ["kb_id_1", "kb_id_2"],
  "question": "你的问题",
  "stream": false,
  "chat_id": "可选的会话ID"
}
```

### 流式问答

```http
POST /api/v1/chat/completion
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "knowledgebase_ids": ["kb_id_1"],
  "question": "你的问题",
  "stream": true
}
```

**流式响应格式**：
```
data: {"text": "部", "id": "chat_xxx"}
data: {"text": "分", "id": "chat_xxx"}
data: {"text": "回", "id": "chat_xxx"}
data: [DONE]
```

### 获取引用来源

问答响应中包含引用信息：

```json
{
  "answer": "回答内容...",
  "reference": {
    "chunks": [
      {
        "content": "引用内容",
        "doc_name": "文档名称",
        "similarity": 0.95,
        "chunk_id": "chunk_xxx"
      }
    ]
  }
}
```

---

## Agent/工作流

### 创建 Agent

```http
POST /api/v1/agent/create
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "name": "Agent 名称",
  "description": "Agent 描述",
  "dsl": {
    "components": [...],
    "edges": [...]
  }
}
```

### 运行 Agent

```http
POST /api/v1/agent/{agent_id}/run
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "inputs": {
    "question": "用户问题"
  },
  "stream": false
}
```

### Agent 模板

RAGFlow 提供预置 Agent 模板：
- 通用问答助手
- 文档分析助手
- 多轮对话助手
- 研究助手（支持联网搜索）

---

## 模型配置

### 支持的模型类型

| 类型 | 说明 | 示例 |
|------|------|------|
| EMBEDDING | 嵌入模型 | bge-large-zh-v1.5, bce-embedding-base_v1 |
| CHAT | 对话模型 | GPT-4, Claude, Qwen, DeepSeek |
| RERANK | 重排序模型 | bce-reranker-base_v1 |
| SPEECH2TEXT | 语音识别 | Whisper |
| IMAGE2TEXT | 图像理解 | 多模态模型 |

### 配置模型

```http
POST /api/v1/llm/config
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "llm_factory": "OpenAI",
  "api_key": "sk-xxx",
  "llm_name": "gpt-4",
  "model_type": "chat"
}
```

### 支持的 LLM 厂商

- OpenAI
- Azure OpenAI
- 通义千问（阿里云）
- 文心一言（百度）
- 讯飞星火
- DeepSeek
- Moonshot
- 智谱 AI
- Ollama（本地部署）
- vLLM

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败（API Key 无效） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

**错误响应格式**：
```json
{
  "code": 400,
  "message": "错误描述",
  "data": null
}
```

---

## 使用示例

### Python 示例

```python
import requests

API_KEY = "your_api_key"
BASE_URL = "http://localhost:80/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 创建知识库
response = requests.post(
    f"{BASE_URL}/knowledgebase/create",
    headers=headers,
    json={
        "name": "测试知识库",
        "description": "用于测试",
        "language": "zh"
    }
)
kb_id = response.json()["data"]["id"]

# 上传文档
files = {"file": open("document.pdf", "rb")}
data = {"kb_id": kb_id}
response = requests.post(
    f"{BASE_URL}/document/upload",
    headers={"Authorization": f"Bearer {API_KEY}"},
    files=files,
    data=data
)

# 等待文档解析完成
import time
time.sleep(10)

# 问答
response = requests.post(
    f"{BASE_URL}/chat/completion",
    headers=headers,
    json={
        "knowledgebase_ids": [kb_id],
        "question": "文档的主要内容是什么？"
    }
)
print(response.json()["data"]["answer"])
```

### cURL 示例

```bash
# 创建知识库
curl -X POST http://localhost:80/api/v1/knowledgebase/create \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试知识库",
    "description": "用于测试",
    "language": "zh"
  }'

# 问答
curl -X POST http://localhost:80/api/v1/chat/completion \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgebase_ids": ["kb_id_xxx"],
    "question": "你的问题"
  }'
```

---

## 高级功能

### 1. 混合检索

RAGFlow 支持：
- 全文检索（Elasticsearch/Infinity）
- 向量检索
- 混合检索（加权融合）
- 重排序（Rerank）

### 2. 文档解析模板

支持多种文档类型解析：
- **Naive**：通用文本
- **QA**：问答对提取
- **Resume**：简历解析
- **Table**：表格提取
- **Manual**：手册解析
- **Paper**：论文解析
- **Book**：书籍解析
- **Laws**：法律条文解析

### 3. 知识图谱

支持知识图谱构建与查询：
- 实体抽取
- 关系抽取
- 图谱可视化
- 图谱增强检索

### 4. 联网搜索

结合 Tavily 等搜索引擎：
- 实时信息检索
- Deep Research 式推理
- 多源信息融合

---

## 最佳实践

### 1. 文档分块策略

```json
{
  "chunk_token_num": 512,  // 每块 token 数
  "chunk_overlap": 50,     // 重叠 token 数
  "delimiter": "\\n"       // 分块分隔符
}
```

### 2. 检索参数调优

```json
{
  "top_k": 10,              // 召回数量
  "similarity_threshold": 0.5,  // 相似度阈值
  "vector_weight": 0.7      // 向量检索权重
}
```

### 3. 性能优化

- 使用 GPU 加速嵌入和 DeepDoc 任务
- 调整 Elasticsearch/Infinity 索引配置
- 合理设置分块大小（512-1024 tokens）
- 启用缓存减少重复计算

---

## 参考资料

- **官方文档**：https://ragflow.io/docs/dev/
- **GitHub 仓库**：https://github.com/infiniflow/ragflow
- **在线 Demo**：https://cloud.ragflow.io
- **Discord 社区**：https://discord.gg/NjYzJD3GM3

---

## 注意事项

1. **API 版本**：本文档基于 v0.19.1 版本，API 可能随版本更新而变化
2. **认证安全**：请妥善保管 API Key，不要泄露
3. **资源限制**：大文件上传和解析可能耗时较长，建议使用异步方式
4. **并发控制**：生产环境请注意 API 调用频率限制

---

*文档生成时间：2026-03-20*
