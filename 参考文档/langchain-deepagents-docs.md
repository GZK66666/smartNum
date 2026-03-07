# LangChain DeepAgents 框架完整文档

## 目录

1. [概述](#概述)
2. [核心概念](#核心概念)
3. [快速开始](#快速开始)
4. [核心功能](#核心功能)
5. [自定义配置](#自定义配置)
6. [后端系统](#后端系统)
7. [最佳实践](#最佳实践)

---

## 概述

### 什么是 DeepAgents？

DeepAgents 是 LangChain 推出的一个**开箱即用的智能体框架**，专为构建能够处理复杂、多步骤任务的 AI 智能体而设计。它基于 LangChain 和 LangGraph 构建，提供了规划、文件系统、子智能体孵化、长期记忆等内置功能。

### LangChain 产品家族对比

| 产品 | 定位 | 适用场景 |
|------|------|----------|
| **DeepAgents** | 开箱即用的智能体框架 | 构建复杂任务智能体，需要规划、文件管理、子智能体等功能 |
| **LangChain** | 基础智能体框架 | 快速构建简单智能体，10 行代码即可开始 |
| **LangGraph** | 低级智能体编排框架 | 需要确定性和智能工作流组合，高度定制化需求 |

### 核心优势

- **开箱即用**：内置规划、文件系统、子智能体孵化等能力
- **上下文管理**：自动压缩长对话，防止上下文溢出
- **虚拟文件系统**：支持多种后端存储（内存、本地磁盘、持久化存储、沙箱）
- **子智能体孵化**：可创建专业子智能体处理特定任务，保持主智能体上下文干净
- **长期记忆**：跨对话持久化存储信息

---

## 核心概念

### 智能体架构

DeepAgents 智能体由以下核心组件构成：

```
┌─────────────────────────────────────────────────────────┐
│                    Deep Agent                           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   规划器    │  │  文件系统   │  │  子智能体   │     │
│  │ (Todos)     │  │  (FS)       │  │  (Spawn)    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  摘要中间件 │  │  记忆系统   │  │  自定义工具 │     │
│  │ (Summarize) │  │  (Memory)   │  │  (Tools)    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 内置工具

DeepAgents 默认提供以下内置工具：

1. **write_todos** - 任务规划和分解
2. **ls** - 列出目录内容
3. **read_file** - 读取文件（支持图片）
4. **write_file** - 写入文件
5. **edit_file** - 编辑文件
6. **task** - 孵化子智能体
7. **glob** - 文件匹配
8. **grep** - 内容搜索

---

## 快速开始

### 安装依赖

```bash
# 使用 pip
pip install deepagents

# 使用 uv
uv add deepagents
```

### 设置 API 密钥

```bash
# Anthropic（默认）
export ANTHROPIC_API_KEY="your-api-key"

# OpenAI
export OPENAI_API_KEY="sk-..."

# 其他工具密钥
export TAVILY_API_KEY="your-tavily-key"
```

### 创建第一个 Deep Agent

```python
from deepagents import create_deep_agent

def get_weather(city: str) -> str:
    """获取指定城市的天气"""
    return f"{city} 今天晴朗！"

# 创建智能体
agent = create_deep_agent(
    tools=[get_weather],
    system_prompt="你是一个有帮助的助手"
)

# 运行智能体
result = agent.invoke({
    "messages": [{"role": "user", "content": "北京天气怎么样？"}]
})

print(result["messages"][-1].content)
```

### 研究智能体示例

```python
import os
from typing import Literal
from tavily import TavilyClient
from deepagents import create_deep_agent

tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """运行网络搜索"""
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )

research_instructions = """
你是一个专家研究员。你的工作是进行彻底的研究，然后撰写一份精美的报告。

你有权使用互联网搜索工具作为收集信息的主要手段。

## internet_search 工具

使用它来运行互联网搜索。你可以指定：
- max_results: 返回的最大结果数
- topic: 搜索主题（general/news/finance）
- include_raw_content: 是否包含原始内容
"""

agent = create_deep_agent(
    tools=[internet_search],
    system_prompt=research_instructions
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "什么是 LangGraph？"}]
})

print(result["messages"][-1].content)
```

### 智能体工作流程

当你运行 Deep Agent 时，它会自动：

1. **规划方法** - 使用 `write_todos` 工具将任务分解为步骤
2. **执行研究** - 调用工具收集信息
3. **管理上下文** - 使用文件系统工具存储大型搜索结果
4. **孵化子智能体** - 将复杂子任务委托给专业子智能体
5. **综合报告** - 将发现编译成连贯的响应

---

## 核心功能

### 1. 规划和任务分解

DeepAgents 内置 `write_todos` 工具，使智能体能够：
- 将复杂任务分解为离散步
- 跟踪进度
- 根据新信息调整计划

```python
# 智能体自动使用 write_todos
# 无需额外配置
```

### 2. 上下文管理

文件系统工具允许智能体：
- 将大型上下文卸载到内存或文件系统存储
- 防止上下文窗口溢出
- 处理可变长度的工具结果

**支持的文件操作：**
- `ls` - 列出目录
- `read_file` - 读取文件（支持图片格式：png, jpg, jpeg, gif, webp）
- `write_file` - 写入文件
- `edit_file` - 编辑文件
- `glob` - 文件模式匹配
- `grep` - 内容搜索

### 3. 可插拔文件系统后端

DeepAgents 支持多种后端：

| 后端类型 | 描述 | 使用场景 |
|----------|------|----------|
| **StateBackend** | 存储在 LangGraph 状态中（临时） | 单次线程的临时存储 |
| **FilesystemBackend** | 本地文件系统 | 本地开发、CI/CD |
| **StoreBackend** | LangGraph Store（持久化） | 跨线程长期存储 |
| **Sandbox** | 隔离沙箱环境 | 生产环境代码执行 |
| **LocalShellBackend** | 本地 Shell + 文件系统 | 本地开发工具 |
| **CompositeBackend** | 复合路由后端 | 混合存储需求 |

**配置示例：**

```python
from deepagents.backends import FilesystemBackend

# 本地文件系统持久化
agent = create_deep_agent(
    backend=FilesystemBackend(root_dir="/path/to/workspace", virtual_mode=True)
)
```

### 4. 子智能体孵化

内置 `task` 工具允许主智能体孵化专业子智能体：

```python
# 智能体内部自动使用
# 当遇到复杂子任务时，会自动创建子智能体处理
# 保持主智能体上下文干净
```

**优势：**
- 上下文隔离
- 专业化处理
- 避免上下文膨胀

### 5. 长期记忆

使用 LangGraph Memory Store 实现跨对话持久化：

```python
from langgraph.store.memory import InMemoryStore
from deepagents import create_deep_agent

agent = create_deep_agent(
    store=InMemoryStore()
)
```

---

## 自定义配置

### create_deep_agent 参数

```python
create_deep_agent(
    name: str | None = None,
    model: str | BaseChatModel | None = None,
    tools: Sequence[BaseTool | Callable | dict[str, Any]] | None = None,
    *,
    system_prompt: str | SystemMessage | None = None,
    middleware: list | None = None,
    backend: BackendProtocol | BackendFactory | None = None,
    store: BaseStore | None = None,
    skills: list | None = None,
    interrupt_on: list | None = None,
) -> CompiledStateGraph
```

### 模型配置

**默认模型：** `claude-sonnet-4-6`

**支持多种模型提供商：**

```python
# OpenAI
agent = create_deep_agent(model="openai:gpt-5")

# Anthropic
agent = create_deep_agent(model="claude-sonnet-4-6")

# Google Gemini
agent = create_deep_agent(model="google_genai:gemini-2.5-flash-lite")

# AWS Bedrock
agent = create_deep_agent(
    model="anthropic.claude-3-5-sonnet-20240620-v1:0",
    model_provider="bedrock_converse"
)

# Azure OpenAI
agent = create_deep_agent(model="azure_openai:gpt-5")

# HuggingFace
agent = create_deep_agent(
    model="microsoft/Phi-3-mini-4k-instruct",
    model_provider="huggingface"
)
```

**使用 init_chat_model 自定义参数：**

```python
from langchain.chat_models import init_chat_model
from deepagents import create_deep_agent

model = init_chat_model(
    model="claude-sonnet-4-6",
    max_retries=10,  # 增加重试次数
    timeout=120,     # 增加超时时间
)

agent = create_deep_agent(model=model)
```

### 自定义工具

```python
from deepagents import create_deep_agent

def get_weather(city: str) -> str:
    """获取城市天气"""
    return f"{city} 的天气晴朗"

def calculate(expression: str) -> str:
    """计算数学表达式"""
    return str(eval(expression))

agent = create_deep_agent(
    tools=[get_weather, calculate]
)
```

### 自定义系统提示

```python
research_instructions = """
你是一个专家研究员。你的工作是进行彻底的研究，然后撰写报告。

工作流程：
1. 首先规划研究步骤
2. 使用搜索工具收集信息
3. 将重要信息保存到文件
4. 综合分析并撰写报告

保持专业、客观的态度。
"""

agent = create_deep_agent(
    system_prompt=research_instructions
)
```

### 中间件（Middleware）

**默认中间件：**

- `TodoListMiddleware` - 任务列表管理
- `FilesystemMiddleware` - 文件系统操作
- `SubAgentMiddleware` - 子智能体孵化
- `SummarizationMiddleware` - 对话摘要
- `AnthropicPromptCachingMiddleware` - Anthropic 提示缓存
- `PatchToolCallsMiddleware` - 工具调用修复

**添加自定义中间件：**

```python
from langchain.tools import tool
from langchain.agents.middleware import wrap_tool_call
from deepagents import create_deep_agent

@tool
def get_weather(city: str) -> str:
    """获取天气"""
    return f"{city} 晴朗"

call_count = [0]

@wrap_tool_call
def log_tool_calls(request, handler):
    """记录所有工具调用"""
    call_count[0] += 1
    tool_name = request.name if hasattr(request, 'name') else str(request)
    
    print(f"[中间件] 工具调用 #{call_count[0]}: {tool_name}")
    print(f"[中间件] 参数：{request.args if hasattr(request, 'args') else 'N/A'}")
    
    result = handler(request)
    
    print(f"[中间件] 工具调用 #{call_count[0]} 完成")
    
    return result

agent = create_deep_agent(
    tools=[get_weather],
    middleware=[log_tool_calls]
)
```

### 子智能体配置

```python
from deepagents import create_deep_agent

# 定义子智能体
subagents = {
    "researcher": {
        "system_prompt": "你是一个专业研究员...",
        "tools": [search_tool]
    },
    "writer": {
        "system_prompt": "你是一个专业作家...",
        "tools": []
    }
}

agent = create_deep_agent(
    subagents=subagents
)
```

### 人机交互（Human-in-the-Loop）

```python
# 在特定操作时暂停等待人工批准
agent = create_deep_agent(
    interrupt_on=["write_file", "execute"]
)
```

### 技能系统（Skills）

```python
# 定义自定义技能
skills = [
    {
        "name": "code_review",
        "description": "代码审查技能",
        "instructions": "..."
    }
]

agent = create_deep_agent(
    skills=skills
)
```

---

## 后端系统详解

### StateBackend（临时存储）

```python
from deepagents.backends import StateBackend

# 默认配置
agent = create_deep_agent()

# 显式配置
agent = create_deep_agent(
    backend=lambda rt: StateBackend(rt)
)
```

**特点：**
- 文件存储在 LangGraph 状态中
- 仅在当前线程内持久化
- 适合临时工作区

### FilesystemBackend（本地磁盘）

```python
from deepagents.backends import FilesystemBackend

agent = create_deep_agent(
    backend=FilesystemBackend(
        root_dir="/path/to/workspace",
        virtual_mode=True  # 启用路径限制
    )
)
```

**⚠️ 安全警告：**
- 仅用于本地开发和 CI/CD
- 不要用于 Web 服务器或生产环境
- 始终启用 `virtual_mode=True`
- 建议使用人机交互审核敏感操作

### StoreBackend（LangGraph Store）

```python
from langgraph.store.memory import InMemoryStore
from deepagents.backends import StoreBackend

agent = create_deep_agent(
    backend=lambda rt: StoreBackend(rt),
    store=InMemoryStore()
)
```

**特点：**
- 跨线程持久化存储
- 适合长期记忆和指令
- 部署到 LangSmith 时可省略 store 参数

### CompositeBackend（复合路由）

```python
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

composite_backend = lambda rt: CompositeBackend(
    default=StateBackend(rt),
    routes={
        "/memories/": StoreBackend(rt),
    }
)

agent = create_deep_agent(
    backend=composite_backend,
    store=InMemoryStore()
)
```

**路由规则：**
- `/workspace/plan.md` → StateBackend（临时）
- `/memories/agent.md` → StoreBackend（持久化）
- 更长前缀优先匹配

### LocalShellBackend（本地 Shell）

```python
from deepagents.backends import LocalShellBackend

agent = create_deep_agent(
    backend=LocalShellBackend(
        root_dir=".",
        env={"PATH": "/usr/bin:/bin"}
    )
)
```

**⚠️ 极度谨慎使用：**
- 提供 Shell 执行权限
- 仅限受信任的本地开发环境
- 强烈建议启用人机交互审核

### 自定义后端

```python
from deepagents.backends.protocol import BackendProtocol, WriteResult
from deepagents.backends.utils import FileInfo, GrepMatch

class S3Backend(BackendProtocol):
    def __init__(self, bucket: str, prefix: str = ""):
        self.bucket = bucket
        self.prefix = prefix.rstrip("/")
    
    def _key(self, path: str) -> str:
        return f"{self.prefix}{path}"
    
    def ls_info(self, path: str) -> list[FileInfo]:
        # 列出 S3 对象
        ...
    
    def read(self, file_path: str, offset: int = 0, limit: int = 2000) -> str:
        # 读取 S3 对象
        ...
    
    def write(self, file_path: str, content: str) -> WriteResult:
        # 写入 S3 对象
        ...
```

### 策略包装器

```python
from deepagents.backends.protocol import BackendProtocol, WriteResult

class PolicyWrapper(BackendProtocol):
    def __init__(self, inner: BackendProtocol, deny_prefixes: list[str]):
        self.inner = inner
        self.deny_prefixes = deny_prefixes
    
    def _deny(self, path: str) -> bool:
        return any(path.startswith(p) for p in self.deny_prefixes)
    
    def write(self, file_path: str, content: str) -> WriteResult:
        if self._deny(file_path):
            return WriteResult(error=f"禁止写入 {file_path}")
        return self.inner.write(file_path, content)
```

---

## 最佳实践

### 1. 选择合适的后端

| 场景 | 推荐后端 |
|------|----------|
| 快速原型 | StateBackend（默认） |
| 本地开发 CLI | FilesystemBackend + virtual_mode=True |
| 生产环境 | Sandbox 后端 |
| 长期记忆 | StoreBackend 或 CompositeBackend |
| 代码执行 | Sandbox 或 LocalShellBackend（开发） |

### 2. 安全建议

- **永远不要**在生产环境使用 LocalShellBackend
- 使用 `virtual_mode=True` 限制文件系统访问
- 启用**人机交互**审核敏感操作
- 从可访问路径中排除敏感文件（.env、密钥等）
- 考虑使用沙箱后端进行隔离

### 3. 上下文管理

- 使用文件系统工具卸载大型工具结果
- 让智能体自动使用 write_todos 规划
- 对于长对话，启用 SummarizationMiddleware
- 使用子智能体隔离复杂任务

### 4. 调试和追踪

```python
# 启用 LangSmith 追踪
import os
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_API_KEY"] = "your-key"

# 智能体执行将自动追踪
```

### 5. 流式输出

```python
# 流式处理智能体响应
for chunk in agent.stream({
    "messages": [{"role": "user", "content": "研究量子计算"}]
}):
    print(chunk)
```

### 6. 错误处理

```python
from langchain.chat_models import init_chat_model

# 配置重试策略
model = init_chat_model(
    model="claude-sonnet-4-6",
    max_retries=10,  # 默认 6 次
    timeout=120,     # 超时时间（秒）
)

agent = create_deep_agent(model=model)
```

---

## 示例应用

### 研究助手

```python
from deepagents import create_deep_agent

researcher = create_deep_agent(
    tools=[internet_search],
    system_prompt="""
    你是专业研究员。请：
    1. 规划研究步骤
    2. 搜索相关信息
    3. 保存重要发现
    4. 撰写综合报告
    """
)
```

### 代码助手

```python
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

coder = create_deep_agent(
    backend=FilesystemBackend(root_dir="/projects", virtual_mode=True),
    system_prompt="""
    你是专业程序员。你可以：
    - 读取和编辑代码文件
    - 运行测试
    - 重构代码
    - 编写文档
    """
)
```

### 数据分析助手

```python
from deepagents import create_deep_agent

analyst = create_deep_agent(
    tools=[load_data, run_query, create_chart],
    system_prompt="""
    你是数据分析师。请：
    1. 理解分析需求
    2. 加载和处理数据
    3. 执行分析
    4. 生成可视化
    5. 撰写分析报告
    """
)
```

---

## 参考资源

- **官方文档**：https://docs.langchain.com/oss/python/deepagents
- **API 参考**：https://reference.langchain.com/python/deepagents/
- **示例代码**：https://github.com/langchain-ai/deepagents/tree/main/examples
- **LangSmith 追踪**：https://docs.smith.langchain.com/

---

## 总结

DeepAgents 是一个功能强大的智能体框架，提供了：

✅ **开箱即用**的智能体能力  
✅ **灵活的配置**选项  
✅ **多种后端**支持  
✅ **安全的执行**环境  
✅ **可扩展的**架构设计  

无论是快速原型还是生产部署，DeepAgents 都能提供合适的能力支持。

---

*文档版本：1.0*  
*基于 LangChain DeepAgents 官方文档整理*  
*更新日期：2026-03-06*
