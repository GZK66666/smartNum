# LangChain DeepAgents 官方完整文档

> 构建能够规划、使用子智能体、并利用文件系统处理复杂任务的智能体

**文档版本**: 官方文档整理版  
**更新日期**: 2026-03-08  
**来源**: https://docs.langchain.com/oss/python/deepagents

---

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [自定义配置](#3-自定义配置)
4. [后端系统](#4-后端系统)
5. [沙箱环境](#5-沙箱环境)
6. [人机交互](#6-人机交互)
7. [子智能体](#7-子智能体)
8. [最佳实践](#8-最佳实践)

---

## 1. 概述

### 什么是 DeepAgents？

DeepAgents 是 LangChain 推出的**开箱即用的智能体框架**，专为构建能够处理复杂、多步骤任务的 AI 智能体而设计。它基于 LangChain 和 LangGraph 构建，提供了规划、文件系统、子智能体孵化、长期记忆等内置功能。

`deepagents` 是一个独立的库，构建在 [LangChain](https://docs.langchain.com/oss/python/langchain/) 的核心智能体构建块之上。它使用 [LangGraph](https://docs.langchain.com/oss/python/langgraph/) 运行时来实现持久执行、流式传输、人机交互等功能。

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

### 何时使用 DeepAgents

**使用 DeepAgents SDK** 当你需要构建能够：

- 处理复杂的多步骤任务，需要规划和分解
- 通过文件系统工具管理大量上下文
- 切换文件系统后端以使用内存状态、本地磁盘、持久化存储、沙箱或自定义后端
- 将工作委托给专门的子智能体以实现上下文隔离
- 跨对话和线程持久化记忆

### 核心能力

#### 1. 规划和任务分解

DeepAgents 包含内置的 `write_todos` 工具，使智能体能够：
- 将复杂任务分解为离散的步骤
- 跟踪进度
- 根据新信息调整计划

#### 2. 上下文管理

文件系统工具（`ls`、`read_file`、`write_file`、`edit_file`）允许智能体将大型上下文卸载到内存或文件系统存储，防止上下文窗口溢出。

#### 3. 可插拔文件系统后端

虚拟文件系统由可插拔后端提供支持，你可以根据用例进行切换。可选择内存状态、本地磁盘、用于跨线程持久化的 LangGraph 存储、用于隔离代码执行的沙箱（Modal、Daytona、Deno），或使用复合路由组合多个后端。

#### 4. 子智能体孵化

内置的 `task` 工具使智能体能够孵化专门的子智能体以实现上下文隔离。

#### 5. 长期记忆

使用 LangGraph 的 Memory Store 跨线程扩展智能体的持久记忆。

---

## 2. 快速开始

### 安装依赖

```bash
# 使用 pip
pip install deepagents tavily-python

# 使用 uv
uv init
uv add deepagents tavily-python
uv sync
```

### 设置 API 密钥

```bash
export ANTHROPIC_API_KEY="your-api-key"
export TAVILY_API_KEY="your-tavily-api-key"
```

### 创建搜索工具

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
```

### 创建 Deep Agent

```python
research_instructions = """You are an expert researcher. Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.
"""

agent = create_deep_agent(
    tools=[internet_search],
    system_prompt=research_instructions
)
```

### 运行智能体

```python
result = agent.invoke({"messages": [{"role": "user", "content": "What is langgraph?"}]})
print(result["messages"][-1].content)
```

### 工作原理

Deep Agent 会自动：
1. **规划方法** - 使用 `write_todos` 工具分解任务
2. **进行研究** - 调用工具收集信息
3. **管理上下文** - 使用文件系统工具存储大型结果
4. **孵化子智能体** - 委托复杂子任务
5. **综合报告** - 编译发现成连贯响应

### 流式输出

```python
for chunk in agent.stream({
    "messages": [{"role": "user", "content": "研究量子计算"}]
}):
    print(chunk)
```

---

## 3. 自定义配置

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

### 连接弹性

```python
from langchain.chat_models import init_chat_model
from deepagents import create_deep_agent

agent = create_deep_agent(
    model=init_chat_model(
        model="claude-sonnet-4-6",
        max_retries=10,  # 增加重试次数（默认：6）
        timeout=120,     # 增加超时时间
    ),
)
```

### 模型配置

#### OpenAI
```python
import os
from deepagents import create_deep_agent

os.environ["OPENAI_API_KEY"] = "sk-..."
agent = create_deep_agent(model="openai:gpt-5.2")
```

#### Anthropic
```python
import os
from deepagents import create_deep_agent

os.environ["ANTHROPIC_API_KEY"] = "sk-..."
agent = create_deep_agent(model="claude-sonnet-4-6")
```

#### Google Gemini
```python
import os
from deepagents import create_deep_agent

os.environ["GOOGLE_API_KEY"] = "..."
agent = create_deep_agent(model="google_genai:gemini-2.5-flash-lite")
```

#### AWS Bedrock
```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="anthropic.claude-3-5-sonnet-20240620-v1:0",
    model_provider="bedrock_converse",
)
```

#### Azure OpenAI
```python
import os
from deepagents import create_deep_agent

os.environ["AZURE_OPENAI_API_KEY"] = "..."
os.environ["AZURE_OPENAI_ENDPOINT"] = "..."
agent = create_deep_agent(model="azure_openai:gpt-5.2")
```

### 自定义工具

```python
from deepagents import create_deep_agent

def get_weather(city: str) -> str:
    """获取城市天气"""
    return f"{city} 的天气晴朗"

agent = create_deep_agent(tools=[get_weather])
```

### 系统提示

```python
from deepagents import create_deep_agent

research_instructions = """You are an expert researcher."""

agent = create_deep_agent(system_prompt=research_instructions)
```

### 中间件

默认中间件：
- `TodoListMiddleware` - 任务列表管理
- `FilesystemMiddleware` - 文件系统操作
- `SubAgentMiddleware` - 子智能体孵化
- `SummarizationMiddleware` - 对话摘要
- `AnthropicPromptCachingMiddleware` - Anthropic 提示缓存
- `PatchToolCallsMiddleware` - 工具调用修复

```python
from langchain.tools import tool
from langchain.agents.middleware import wrap_tool_call
from deepagents import create_deep_agent

@tool
def get_weather(city: str) -> str:
    """获取天气"""
    return f"{city} 晴朗"

@wrap_tool_call
def log_tool_calls(request, handler):
    """记录所有工具调用"""
    print(f"工具调用：{request.name}")
    result = handler(request)
    print(f"工具调用完成")
    return result

agent = create_deep_agent(
    tools=[get_weather],
    middleware=[log_tool_calls],
)
```

### 子智能体配置

```python
from deepagents import create_deep_agent

research_subagent = {
    "name": "research-agent",
    "description": "用于更深入地研究问题",
    "system_prompt": "你是一个优秀的研究员",
    "tools": [internet_search],
    "model": "openai:gpt-5.2",
}

agent = create_deep_agent(
    model="claude-sonnet-4-6",
    subagents=[research_subagent]
)
```

### 后端配置

#### StateBackend（临时）
```python
from deepagents.backends import StateBackend
agent = create_deep_agent(backend=lambda rt: StateBackend(rt))
```

#### FilesystemBackend（本地磁盘）
```python
from deepagents.backends import FilesystemBackend
agent = create_deep_agent(
    backend=FilesystemBackend(root_dir=".", virtual_mode=True)
)
```

#### StoreBackend（持久化）
```python
from langgraph.store.memory import InMemoryStore
from deepagents.backends import StoreBackend

agent = create_deep_agent(
    backend=lambda rt: StoreBackend(rt),
    store=InMemoryStore()
)
```

#### CompositeBackend（复合路由）
```python
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.memory import InMemoryStore

composite_backend = lambda rt: CompositeBackend(
    default=StateBackend(rt),
    routes={"/memories/": StoreBackend(rt)},
)

agent = create_deep_agent(
    backend=composite_backend,
    store=InMemoryStore()
)
```

### 人机交互

```python
from langchain.tools import tool
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
def delete_file(path: str) -> str:
    """删除文件"""
    return f"已删除 {path}"

checkpointer = MemorySaver()

agent = create_deep_agent(
    tools=[delete_file],
    interrupt_on={"delete_file": True},
    checkpointer=checkpointer
)
```

### 技能（Skills）

```python
from deepagents import create_deep_agent
from deepagents.backends.utils import create_file_data
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()

skills_files = {
    "/skills/langgraph-docs/SKILL.md": create_file_data(skill_content)
}

agent = create_deep_agent(
    skills=["/skills/"],
    checkpointer=checkpointer,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "什么是 LangGraph？"}]},
    config={"configurable": {"thread_id": "12345"}},
)
```

### 记忆（Memory）

```python
from deepagents import create_deep_agent
from deepagents.backends.utils import create_file_data
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()

agent = create_deep_agent(
    memory=["/AGENTS.md"],
    checkpointer=checkpointer,
)
```

### 结构化输出

```python
from pydantic import BaseModel, Field
from deepagents import create_deep_agent

class WeatherReport(BaseModel):
    location: str = Field(description="位置")
    temperature: float = Field(description="温度（摄氏度）")
    condition: str = Field(description="天气状况")

agent = create_deep_agent(response_format=WeatherReport)
```

---

## 4. 后端系统

### 内置后端对比

| 后端 | 描述 | 使用场景 |
|------|------|----------|
| StateBackend | 临时存储在 LangGraph 状态中 | 单次线程的临时存储 |
| FilesystemBackend | 本地文件系统 | 本地开发、CI/CD |
| StoreBackend | LangGraph Store | 跨线程长期存储 |
| Sandbox | 隔离沙箱环境 | 生产环境代码执行 |
| LocalShellBackend | 本地 Shell + 文件系统 | 本地开发工具 |
| CompositeBackend | 复合路由后端 | 混合存储需求 |

### StateBackend（临时）

```python
agent = create_deep_agent()
```

**特点**：
- 文件存储在 LangGraph 状态中
- 仅在当前线程内持久化
- 适合临时工作区

### FilesystemBackend（本地磁盘）

> ⚠️ **警告**：此后端授予智能体直接文件系统读/写访问权限。谨慎使用！

```python
from deepagents.backends import FilesystemBackend

agent = create_deep_agent(
    backend=FilesystemBackend(root_dir=".", virtual_mode=True)
)
```

**安全建议**：
- 仅用于本地开发和 CI/CD
- 不要用于 Web 服务器或生产环境
- 始终启用 `virtual_mode=True`
- 建议使用人机交互审核敏感操作

### LocalShellBackend（本地 Shell）

> ⚠️ **极度谨慎**：提供 Shell 执行权限！

```python
from deepagents.backends import LocalShellBackend

agent = create_deep_agent(
    backend=LocalShellBackend(root_dir=".", env={"PATH": "/usr/bin:/bin"})
)
```

### StoreBackend（LangGraph Store）

```python
from langgraph.store.memory import InMemoryStore
from deepagents.backends import StoreBackend

agent = create_deep_agent(
    backend=lambda rt: StoreBackend(rt),
    store=InMemoryStore()
)
```

### CompositeBackend（复合路由）

```python
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

composite_backend = lambda rt: CompositeBackend(
    default=StateBackend(rt),
    routes={"/memories/": StoreBackend(rt)},
)

agent = create_deep_agent(backend=composite_backend)
```

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

---

## 5. 沙箱环境

### 为什么使用沙箱？

沙箱提供隔离环境，让智能体可以执行任意代码、访问文件和使用网络，而不会危及你的凭证、本地文件或主机系统。

**适用场景**：
- 编码智能体：运行 Shell、git、克隆仓库、Docker-in-Docker
- 数据分析智能体：加载文件、安装库、运行统计计算

### 集成模式

#### 模式 1：智能体在沙箱内
智能体在沙箱内运行，你通过网络与之通信。

```dockerfile
FROM python:3.11
RUN pip install deepagents-cli
```

#### 模式 2：沙箱作为工具
智能体在你的机器上运行，需要执行代码时调用沙箱工具。

```python
from daytona import Daytona
from langchain_daytona import DaytonaSandbox
from deepagents import create_deep_agent

sandbox = Daytona().create()
backend = DaytonaSandbox(sandbox=sandbox)

agent = create_deep_agent(
    backend=backend,
    system_prompt="你是可以访问沙箱的编码助手",
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "创建并运行 Hello World"}]
})
```

### 可用提供商

| 提供商 | 特点 |
|--------|------|
| Modal | ML/AI 工作负载，GPU 访问 |
| Daytona | TypeScript/Python 开发，快速冷启动 |
| Runloop | 一次性 devbox，隔离代码执行 |

### 基本使用

#### Modal
```python
import modal
from langchain_modal import ModalSandbox
from deepagents import create_deep_agent

app = modal.App.lookup("your-app")
modal_sandbox = modal.Sandbox.create(app=app)
backend = ModalSandbox(sandbox=modal_sandbox)

agent = create_deep_agent(backend=backend)
```

#### Daytona
```python
from daytona import Daytona
from langchain_daytona import DaytonaSandbox
from deepagents import create_deep_agent

sandbox = Daytona().create()
backend = DaytonaSandbox(sandbox=sandbox)

agent = create_deep_agent(backend=backend)
```

### 文件操作

#### 种子化沙箱
```python
backend.upload_files([
    ("/src/index.py", b"print('Hello')\n"),
    ("/pyproject.toml", b"[project]\nname = 'my-app'\n"),
])
```

#### 检索产物
```python
results = backend.download_files(["/src/index.py", "/output.txt"])
for result in results:
    if result.content is not None:
        print(f"{result.path}: {result.content.decode()}")
```

### 生命周期和清理

```python
# Modal
modal_sandbox.terminate()

# Daytona
sandbox.stop()

# Runloop
devbox.shutdown()
```

### 安全考虑

> ⚠️ **切勿在沙箱内放置密钥**！API 密钥、令牌、数据库凭证等可能被上下文注入攻击读取和外泄。

**安全处理密钥**：
1. 将密钥保留在沙箱外的工具中（推荐）
2. 使用网络代理注入凭证

---

## 6. 人机交互

### 基本配置

```python
from langchain.tools import tool
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
def delete_file(path: str) -> str:
    """删除文件"""
    return f"已删除 {path}"

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """发送邮件"""
    return f"已发送邮件到 {to}"

checkpointer = MemorySaver()

agent = create_deep_agent(
    tools=[delete_file, send_email],
    interrupt_on={
        "delete_file": True,  # 默认：批准、编辑、拒绝
        "send_email": {"allowed_decisions": ["approve", "reject"]},
    },
    checkpointer=checkpointer
)
```

### 决策类型

| 决策 | 描述 |
|------|------|
| `approve` | 按原参数执行工具 |
| `edit` | 修改参数后执行 |
| `reject` | 跳过执行 |

### 处理中断

```python
import uuid
from langgraph.types import Command

config = {"configurable": {"thread_id": str(uuid.uuid4())}}

result = agent.invoke({
    "messages": [{"role": "user", "content": "删除 temp.txt"}]
}, config=config)

if result.get("__interrupt__"):
    interrupts = result["__interrupt__"][0].value
    action_requests = interrupts["action_requests"]
    
    # 显示待批准的操作
    for action in action_requests:
        print(f"工具：{action['name']}")
        print(f"参数：{action['args']}")
    
    # 获取用户决策
    decisions = [{"type": "approve"}]
    
    # 恢复执行
    result = agent.invoke(
        Command(resume={"decisions": decisions}),
        config=config
    )
```

### 编辑工具参数

```python
if result.get("__interrupt__"):
    decisions = [{
        "type": "edit",
        "edited_action": {
            "name": "send_email",
            "args": {"to": "team@company.com", "subject": "...", "body": "..."}
        }
    }]
    
    result = agent.invoke(
        Command(resume={"decisions": decisions}),
        config=config
    )
```

---

## 7. 子智能体

### 为什么使用子智能体？

子智能体解决**上下文膨胀问题**。当智能体使用大型输出的工具时，上下文窗口会迅速填满。子智能体隔离这些详细工作——主智能体只接收最终结果。

**何时使用**：
- ✅ 多步骤任务会弄乱主智能体上下文
- ✅ 需要自定义指令或工具的专业领域
- ✅ 需要不同模型能力的任务

**何时不使用**：
- ❌ 简单的单步任务
- ❌ 需要维护中间上下文时

### 配置子智能体

```python
from deepagents import create_deep_agent

research_subagent = {
    "name": "research-agent",
    "description": "用于更深入地研究问题",
    "system_prompt": "你是一个优秀的研究员",
    "tools": [internet_search],
    "model": "openai:gpt-5.2",
}

agent = create_deep_agent(
    model="claude-sonnet-4-6",
    subagents=[research_subagent]
)
```

### 子智能体字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `name` | `str` | 必需。子智能体的唯一标识符 |
| `description` | `str` | 必需。子智能体做什么的描述 |
| `system_prompt` | `str` | 必需。子智能体的指令 |
| `tools` | `list[Callable]` | 必需。子智能体可以使用的工具 |
| `model` | `str` | 可选。覆盖主智能体的模型 |
| `middleware` | `list[Middleware]` | 可选。额外的中间件 |
| `interrupt_on` | `dict[str, bool]` | 可选。人机交互配置 |
| `skills` | `list[str]` | 可选。技能源路径 |

### 通用子智能体

Deep Agents 始终可以访问 `general-purpose` 子智能体：
- 与主智能体相同的系统提示
- 访问所有相同的工具
- 使用相同的模型（除非覆盖）
- 继承主智能体的技能

### 覆盖通用子智能体

```python
agent = create_deep_agent(
    model="claude-sonnet-4-6",
    subagents=[
        {
            "name": "general-purpose",
            "description": "通用智能体",
            "system_prompt": "你是通用助手",
            "tools": [internet_search],
            "model": "openai:gpt-4o",
        },
    ],
)
```

### 最佳实践

#### 编写清晰的描述
```python
# ✅ 好
{"description": "分析财务数据并生成带有置信度分数的投资洞察"}

# ❌ 差
{"description": "做金融相关的事情"}
```

#### 保持系统提示详细
```python
system_prompt = """你是 thorough 研究员。你的工作是：

1. 将研究问题分解为可搜索的查询
2. 使用 internet_search 查找相关信息
3. 将发现综合成简洁的摘要
4. 引用来源

输出格式：
- 摘要（2-3 段）
- 关键发现（要点）
- 来源（带 URL）

保持响应在 500 字以内。"""
```

#### 最小化工具集
```python
# ✅ 好：专注的工具集
email_agent = {
    "name": "email-sender",
    "tools": [send_email, validate_email],
}
```

#### 按任务选择模型
```python
subagents = [
    {
        "name": "contract-reviewer",
        "model": "claude-sonnet-4-6",  # 大上下文用于长文档
    },
    {
        "name": "financial-analyst",
        "model": "openai:gpt-5",  # 更好的数值分析
    },
]
```

---

## 8. 最佳实践

### 选择合适的后端

| 场景 | 推荐后端 |
|------|----------|
| 快速原型 | StateBackend（默认） |
| 本地开发 CLI | FilesystemBackend + virtual_mode=True |
| 生产环境 | Sandbox 后端 |
| 长期记忆 | StoreBackend 或 CompositeBackend |
| 代码执行 | Sandbox 或 LocalShellBackend（开发） |

### 安全建议

- ⚠️ **永远不要**在生产环境使用 LocalShellBackend
- ✅ 使用 `virtual_mode=True` 限制文件系统访问
- ✅ 启用人机交互审核敏感操作
- ✅ 从可访问路径中排除敏感文件（.env、密钥等）
- ✅ 考虑使用沙箱后端进行隔离
- ⚠️ **切勿在沙箱内放置密钥**

### 上下文管理

- 使用文件系统工具卸载大型工具结果
- 让智能体自动使用 write_todos 规划
- 对于长对话，启用 SummarizationMiddleware
- 使用子智能体隔离复杂任务

### 调试和追踪

```python
import os
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_API_KEY"] = "your-key"
```

### 错误处理

```python
from langchain.chat_models import init_chat_model

model = init_chat_model(
    model="claude-sonnet-4-6",
    max_retries=10,
    timeout=120,
)

agent = create_deep_agent(model=model)
```

---

## 参考资源

- **官方文档**：https://docs.langchain.com/oss/python/deepagents
- **API 参考**：https://reference.langchain.com/python/deepagents/
- **示例代码**：https://github.com/langchain-ai/deepagents/tree/main/examples
- **LangSmith 追踪**：https://docs.smith.langchain.com/

---

*文档版本：1.0*  
*基于 LangChain DeepAgents 官方文档整理*  
*更新日期：2026-03-08*
