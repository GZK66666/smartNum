# 智能体查询指南优化

**日期**: 2026-03-20
**目标**: 让智能体在执行查询前主动查阅查询指南

---

## 问题分析

现有实现中，虽然每个数据源已绑定查询指南，但智能体不会主动使用。原因是：
1. 工具描述过于命令式，缺少使用场景引导
2. 缺少语义搜索能力，需要手动输入 grep 命令
3. 系统提示词没有明确引导

---

## 优化方案

遵循 **Smart Agent, Dumb Tool** 原则：
- 不在系统提示词中加入太多限制
- 在工具描述、工具定义部分说明使用场景
- 增加更智能的搜索工具
- 保持简洁，给智能体最大探索空间

---

## 已完成的改动

### 1. 优化 `explore_query_guide` 工具描述

**修改位置**: `app/services/agent_service.py`

**改动内容**:
```python
@tool
async def explore_query_guide(command: str) -> str:
    """浏览数据库查询指南文档。

    查询指南包含该数据库的业务说明、统计口径、表字段说明等参考信息。
    当需要了解业务含义、确认统计方式或查找特定术语时，使用此工具浏览文档。

    # 原文
    查询指南包含该数据库的业务规则、数据字典、SQL 参考等具体查询要求。
    在查询数据前，建议先查阅查询指南。
    不确定业务逻辑时，务必查阅查询指南。
    """
```

**优化点**:
- 将"建议/务必"等命令式语气改为场景描述
- 明确说明何时使用此工具（了解业务含义、确认统计方式、查找术语）
- 让智能体根据场景自行判断是否需要调用

---

### 2. 新增 `search_query_guide` 工具

**修改位置**: `app/services/agent_service.py`

**工具定义**:
```python
@tool
async def search_query_guide(keyword: str) -> str:
    """在查询指南中搜索与用户问题相关的信息。

    当需要确认业务规则、统计口径或查找特定概念时，先调用此工具搜索相关内容。
    此工具会自动在查询指南的所有文档中搜索包含关键词的内容。

    Args:
        keyword: 搜索关键词，建议使用与用户问题相关的业务术语

    Returns:
        搜索结果，包含匹配的文件名和相关段落
    """
```

**实现逻辑**:
1. 调用 `list_guide_structure` 获取文件列表
2. 使用 `grep -ri` 自动搜索关键词（不区分大小写）
3. 返回搜索结果，如未找到则返回文件列表提示

**优势**:
- 智能体只需传入关键词，无需编写 grep 命令
- 自动在所有文档中搜索，并返回上下文片段
- 搜索失败时仍提供有用的文件列表信息

---

### 3. 优化系统提示词

**修改位置**: `app/services/agent_service.py`

**新版本**:
```python
SYSTEM_PROMPT = """你是 SmartNum 数据分析助手，帮助用户查询和分析数据库中的数据。

## 工具

### search_query_guide / explore_query_guide
查询指南包含业务说明、统计口径、表字段说明等参考信息。
当遇到业务术语、需要确认计算方式或查找特定概念时，先搜索查询指南。

### list_tables
列出数据库中的表。

### get_table_schema
获取表的字段结构。

### run_sql
执行 SELECT 查询。

### render_chart / export_data
图表渲染和数据导出。

## 输出

数据用 Markdown 表格展示。只执行 SELECT 语句，不查询敏感数据。
"""
```

**优化点**:
- 将 `search_query_guide` 和 `explore_query_guide` 放在一起说明
- 用场景化的语言描述何时使用（遇到业务术语、确认计算方式、查找概念）
- 移除了原 `explore_query_guide` 的示例命令，简化提示词
- 整体保持简洁，给智能体更多探索空间

---

### 4. 注册新工具

**修改位置**: `app/services/agent_service.py` 中的 `get_agent()` 函数

```python
tools=[
    list_tables, get_table_schema, run_sql, render_chart, export_data,
    explore_query_guide, search_query_guide,  # 添加了 search_query_guide
],
```

---

## 使用示例

### 场景 1：用户问"什么是活跃用户？"

**预期智能体行为**:
1. 调用 `search_query_guide(keyword="活跃用户")` 搜索定义
2. 找到相关文档后，基于查询指南回答

### 场景 2：用户问"GMV 怎么计算的？"

**预期智能体行为**:
1. 调用 `search_query_guide(keyword="GMV")` 或 `search_query_guide(keyword="计算口径")`
2. 找到统计规则后，生成正确的 SQL

### 场景 3：用户想了解某个数据源有哪些文档

**预期智能体行为**:
1. 调用 `explore_query_guide(command="ls -la")` 列出文件
2. 根据文件名判断哪些文档可能有用

---

## 后续建议

1. **测试验证**: 观察智能体在实际问题中的工具调用行为
2. **工具描述迭代**: 根据实际使用情况，微调工具描述中的场景说明
3. **考虑添加 RAG**: 如果查询指南文档很多，可以考虑添加向量检索，让搜索更智能

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `app/services/agent_service.py` | 修改 | 优化工具描述、新增 `search_query_guide` 工具、更新系统提示词 |

---

## 设计原则总结

1. **Smart Agent**: 智能体自行决定何时查阅指南，不强制
2. **Dumb Tool**: 工具描述清晰说明使用场景，但不限制用法
3. **简洁优先**: 系统提示词保持简短，避免过多规则
4. **渐进增强**: 在现有架构上增加搜索能力，不改变整体逻辑
