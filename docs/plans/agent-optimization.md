# 智能体查询指南优化 - 文件系统即工具

**日期**: 2026-03-20
**设计灵感**: Vercel d0 代理 - "We removed 80% of our agent's tools"

---

## 核心理念

**文件系统是智能体，不是搜索工具。**

参考 Vercel 的 text-to-SQL 代理架构演进：
- **v1 架构**: 多个专用工具（schema 查询、查询验证、错误恢复、上下文检索...）→ 80% 成功率，慢，脆弱
- **v2 架构**: 一个工具 `executeCommand`（bash）→ 100% 成功率，3.5 倍快，37% 更少 token

> "Addition by subtraction is real. The best agents might be the ones with the fewest tools."

---

## 问题分析

我之前的优化思路是错误的：
- 添加 `search_query_guide` 专用搜索工具
- 在工具描述中告诉智能体"何时使用"
- 本质上是在约束智能体的推理能力

**正确的方式**：
- 只提供一个工具：`explore_query_guide`（bash 命令执行）
- 智能体自己决定用 `ls`、`cat`、`grep` 去探索
- 给智能体最大程度的探索自由

---

## 优化方案

### 极简系统提示词

```markdown
你是 SmartNum 数据分析助手，帮助用户查询和分析数据库中的数据。

## 工具

### explore_query_guide
使用 shell 命令浏览查询指南文档（ls, cat, grep 等）。
查询指南包含业务说明、统计口径、表字段说明等参考信息。

### list_tables
列出数据库中的表。

### get_table_schema
获取表的字段结构。

### run_sql
执行 SELECT 查询。

### render_chart / export_data
图表渲染和数据导出。
```

**设计点**：
- 不告诉智能体"必须先查阅指南"
- 不约束使用场景
- 只说明工具是什么，让智能体自己判断

### 极简工具描述

```python
@tool
async def explore_query_guide(command: str) -> str:
    """使用 shell 命令浏览查询指南文档。

    查询指南包含该数据库的业务说明、统计口径、表字段说明等参考信息。
    你可以使用任何 shell 命令来探索内容。

    常用命令:
    - ls -la : 查看有哪些文档
    - cat *.md : 阅读文档内容
    - grep "关键词" . -r : 搜索特定内容
    - head -20 xxx.md : 查看文件前 20 行
    """
```

**设计点**：
- 不限制命令列表（只给示例）
- 强调"可以使用任何 shell 命令"
- 给智能体最大探索空间

---

## 预期行为

当用户问"什么是活跃用户？"时，智能体可能：

```
1. explore_query_guide("ls -la")           # 先看看有什么文档
2. explore_query_guide("cat 业务说明.md")   # 阅读相关文档
3. explore_query_guide("grep -r '活跃' .")  # 或直接搜索关键词
4. run_sql(...)                             # 基于理解生成 SQL
```

或者智能体可能选择：
- 直接用 `grep -r "活跃用户" .` 一步到位
- 或者先 `list_tables()` 了解表结构

**关键是：让智能体自己决定探索策略，而不是我们替它做决定。**

---

## 设计原则总结

| 原则 | 实现 |
|------|------|
| **Fewest tools** | 只保留一个 bash 工具，不加专用搜索 |
| **Don't constrain reasoning** | 不告诉智能体"必须先查指南" |
| **File system is the agent** | 查询指南就是文件，智能体用 Unix 命令探索 |
| **Build for the model you'll have** | 相信 Opus 4.6 的推理能力，不做过度防护 |

---

## 文件变更

| 文件 | 变更 |
|------|------|
| `app/services/agent_service.py` | 简化系统提示词、简化 `explore_query_guide` 描述、移除 `search_query_guide` |

---

## 参考

- [Vercel: We removed 80% of our agent's tools](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools)
- 关键洞察："Models are getting smarter and context windows are getting larger, so maybe the best agent architecture is almost no architecture at all."
