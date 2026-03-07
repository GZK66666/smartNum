# 智能问数系统 (smartNum) 产品需求文档

**版本**: 1.0
**日期**: 2026-03-07
**作者**: 产品经理

---

## 1. 产品概述

### 1.1 产品定位

smartNum 是一款智能问数系统，旨在让非技术用户也能通过自然语言查询数据库，降低数据分析门槛，提升数据驱动决策效率。

### 1.2 核心价值

- **自然语言交互**：用户无需学习 SQL，用日常语言提问即可获得数据
- **多轮对话**：支持追问和深入分析，逐步细化数据洞察
- **灵活配置**：用户可自行配置数据源，无需依赖 IT 部门

### 1.3 目标用户

| 用户群体 | 使用场景 | 核心诉求 |
|---------|---------|---------|
| 业务分析师 | 日常数据查询、报表制作 | 快速获取数据，减少等待时间 |
| 产品经理 | 用户行为分析、指标监控 | 自助查询，不依赖数据团队 |
| 管理层 | 经营数据查看、决策支持 | 即时获取关键指标 |
| 运营人员 | 活动效果分析、用户画像 | 灵活查询，快速迭代 |

### 1.4 版本范围 (v1.0)

| 功能 | 是否支持 |
|-----|---------|
| 自然语言转 SQL | ✅ |
| 多轮对话 | ✅ |
| 数据源配置 | ✅ |
| 查询结果展示 | ✅ |
| 数据可视化 | ❌ (规划中) |
| 持久化存储 | ❌ (规划中) |
| 用户认证 | ❌ (规划中) |

---

## 2. 功能需求详述

### 2.1 数据源配置

#### 2.1.1 功能描述

用户可在前端配置数据库连接信息，系统支持多种数据库类型。

#### 2.1.2 支持的数据库

| 数据库类型 | 优先级 | 备注 |
|-----------|-------|------|
| MySQL | P0 | 首版支持 |
| PostgreSQL | P0 | 首版支持 |
| SQLite | P1 | 首版支持（用于测试） |
| Oracle | P2 | 后续版本 |
| SQL Server | P2 | 后续版本 |

#### 2.1.3 配置项

```json
{
  "name": "数据源名称",
  "type": "mysql|postgresql|sqlite",
  "host": "数据库主机地址",
  "port": "端口号",
  "database": "数据库名称",
  "username": "用户名",
  "password": "密码（加密存储）",
  "schema": "Schema名称（可选）"
}
```

#### 2.1.4 验证规则

- 连接测试：保存前验证连接有效性
- 权限检查：确保用户具有 SELECT 权限
- 安全存储：密码使用 AES 加密（内存中）

### 2.2 自然语言查询

#### 2.2.1 功能描述

用户输入自然语言问题，系统自动转换为 SQL 并执行，返回查询结果。

#### 2.2.2 查询流程

```
用户输入 → 意图理解 → Schema检索 → SQL生成 → 执行查询 → 结果展示
```

#### 2.2.3 查询类型支持

| 查询类型 | 示例 | 支持程度 |
|---------|-----|---------|
| 简单查询 | "查询所有用户" | ✅ |
| 聚合查询 | "统计每个部门的员工数" | ✅ |
| 条件筛选 | "查询销售额大于1万的订单" | ✅ |
| 多表关联 | "查询每个用户的订单总额" | ✅ |
| 排序分页 | "销售额前10的产品" | ✅ |
| 时间查询 | "上个月的订单量" | ✅ |
| 复杂子查询 | "查询购买过A商品的用户购买的其他商品" | ⚠️ 有限支持 |

#### 2.2.4 安全机制

- **SQL 注入防护**：只允许 SELECT 语句
- **敏感表保护**：可配置禁止查询的表
- **结果数量限制**：默认最大返回 1000 条
- **查询超时**：默认 30 秒超时

### 2.3 多轮对话

#### 2.3.1 功能描述

用户可对查询结果进行追问，系统基于上下文理解用户意图。

#### 2.3.2 对话能力

| 对话类型 | 示例 |
|---------|-----|
| 结果筛选 | "只要北京的" |
| 维度下钻 | "按月份拆分" |
| 指标对比 | "和去年同期对比" |
| 追加条件 | "再加一个条件：状态为已完成" |
| 结果解释 | "为什么销售额下降了？" |
| 查询修正 | "我要的是订单数不是金额" |

#### 2.3.3 上下文管理

- **会话隔离**：每个数据源独立会话
- **上下文窗口**：保留最近 10 轮对话
- **上下文压缩**：长对话自动压缩历史

### 2.4 结果展示

#### 2.4.1 展示格式

| 格式 | 说明 |
|-----|------|
| 表格 | 默认展示，支持排序 |
| JSON | 原始数据格式 |
| SQL | 展示生成的 SQL 语句 |

#### 2.4.2 交互功能

- 列排序
- 关键词高亮
- 复制结果
- 导出 CSV

---

## 3. 用户交互流程

### 3.1 整体流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        smartNum 系统流程                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   数据源配置   │───→│   连接验证    │───→│   Schema加载  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                                        │              │
│         ▼                                        ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  选择数据源   │←───│   数据源列表   │←───│  Schema缓存   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                                                      │
│         ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      对话交互界面                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  用户输入: "查询上个月销售额前10的产品"               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                          │                               │  │
│  │                          ▼                               │  │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐│  │
│  │  │   意图理解    │───→│  Schema匹配   │───→│   SQL生成    ││  │
│  │  └──────────────┘    └──────────────┘    └──────────────┘│  │
│  │                          │                               │  │
│  │                          ▼                               │  │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐│  │
│  │  │   SQL执行    │───→│  结果格式化   │───→│   展示结果    ││  │
│  │  └──────────────┘    └──────────────┘    └──────────────┘│  │
│  │                          │                               │  │
│  │                          ▼                               │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  用户追问: "按地区拆分"                              │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                          │                               │  │
│  │                          ▼ (循环)                        │  │
│  │                    [继续对话...]                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 数据源配置流程

```
开始
  │
  ▼
点击"添加数据源"
  │
  ▼
选择数据库类型 ──────→ [MySQL/PostgreSQL/SQLite]
  │
  ▼
填写连接信息
  │
  ├── 名称 (必填)
  ├── 主机地址 (必填)
  ├── 端口 (必填)
  ├── 数据库名 (必填)
  ├── 用户名 (必填)
  └── 密码 (必填)
  │
  ▼
点击"测试连接"
  │
  ├── 失败 ──→ 显示错误信息 ──→ 修改配置
  │
  └── 成功
        │
        ▼
      点击"保存"
        │
        ▼
      Schema自动加载
        │
        ▼
      数据源列表显示新数据源
        │
        ▼
      结束
```

### 3.3 查询对话流程

```
开始
  │
  ▼
选择数据源
  │
  ▼
进入对话界面
  │
  ▼
输入自然语言问题
  │
  ▼
系统处理
  │
  ├── 意图识别
  ├── Schema匹配
  ├── SQL生成
  └── 执行查询
  │
  ▼
展示结果
  │
  ├── 表格展示
  ├── 显示SQL
  └── 结果统计
  │
  ▼
用户操作
  │
  ├── 查看详情 ──→ 展示完整数据
  ├── 追问 ──────→ 返回"输入问题"
  ├── 修正 ──────→ 返回"输入问题"
  ├── 切换数据源 → 返回"选择数据源"
  └── 结束 ──────→ 结束
```

---

## 4. API 接口文档

### 4.1 接口概述

| 接口 | 方法 | 路径 | 说明 |
|-----|------|------|------|
| 数据源列表 | GET | /api/datasources | 获取所有数据源 |
| 添加数据源 | POST | /api/datasources | 添加新数据源 |
| 测试连接 | POST | /api/datasources/test | 测试数据库连接 |
| 删除数据源 | DELETE | /api/datasources/{id} | 删除数据源 |
| 获取Schema | GET | /api/datasources/{id}/schema | 获取数据库Schema |
| 创建会话 | POST | /api/sessions | 创建新会话 |
| 发送消息 | POST | /api/sessions/{id}/messages | 发送用户消息 |
| 获取历史 | GET | /api/sessions/{id}/messages | 获取对话历史 |
| 删除会话 | DELETE | /api/sessions/{id} | 删除会话 |

### 4.2 数据源管理接口

#### 4.2.1 获取数据源列表

**请求**
```http
GET /api/datasources
```

**响应**
```json
{
  "code": 0,
  "data": [
    {
      "id": "ds_001",
      "name": "生产数据库",
      "type": "mysql",
      "host": "192.168.1.100",
      "port": 3306,
      "database": "production",
      "status": "connected",
      "created_at": "2026-03-07T10:00:00Z"
    }
  ]
}
```

#### 4.2.2 添加数据源

**请求**
```http
POST /api/datasources
Content-Type: application/json

{
  "name": "测试数据库",
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "database": "test_db",
  "username": "root",
  "password": "password123"
}
```

**响应**
```json
{
  "code": 0,
  "data": {
    "id": "ds_002",
    "name": "测试数据库",
    "type": "mysql",
    "status": "connected",
    "created_at": "2026-03-07T10:30:00Z"
  }
}
```

#### 4.2.3 测试连接

**请求**
```http
POST /api/datasources/test
Content-Type: application/json

{
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "database": "test_db",
  "username": "root",
  "password": "password123"
}
```

**响应**
```json
{
  "code": 0,
  "data": {
    "success": true,
    "message": "连接成功",
    "version": "MySQL 8.0.32"
  }
}
```

#### 4.2.4 获取Schema

**请求**
```http
GET /api/datasources/{id}/schema
```

**响应**
```json
{
  "code": 0,
  "data": {
    "tables": [
      {
        "name": "users",
        "comment": "用户表",
        "columns": [
          {
            "name": "id",
            "type": "int",
            "nullable": false,
            "key": "PRI",
            "comment": "用户ID"
          },
          {
            "name": "name",
            "type": "varchar(100)",
            "nullable": false,
            "comment": "用户名"
          },
          {
            "name": "email",
            "type": "varchar(255)",
            "nullable": true,
            "comment": "邮箱"
          },
          {
            "name": "created_at",
            "type": "datetime",
            "nullable": false,
            "comment": "创建时间"
          }
        ]
      },
      {
        "name": "orders",
        "comment": "订单表",
        "columns": [
          {
            "name": "id",
            "type": "int",
            "nullable": false,
            "key": "PRI",
            "comment": "订单ID"
          },
          {
            "name": "user_id",
            "type": "int",
            "nullable": false,
            "key": "MUL",
            "comment": "用户ID"
          },
          {
            "name": "amount",
            "type": "decimal(10,2)",
            "nullable": false,
            "comment": "订单金额"
          },
          {
            "name": "status",
            "type": "varchar(20)",
            "nullable": false,
            "comment": "订单状态"
          },
          {
            "name": "created_at",
            "type": "datetime",
            "nullable": false,
            "comment": "创建时间"
          }
        ]
      }
    ]
  }
}
```

### 4.3 对话接口

#### 4.3.1 创建会话

**请求**
```http
POST /api/sessions
Content-Type: application/json

{
  "datasource_id": "ds_001"
}
```

**响应**
```json
{
  "code": 0,
  "data": {
    "session_id": "sess_abc123",
    "datasource_id": "ds_001",
    "created_at": "2026-03-07T11:00:00Z"
  }
}
```

#### 4.3.2 发送消息

**请求**
```http
POST /api/sessions/{session_id}/messages
Content-Type: application/json

{
  "content": "查询上个月销售额前10的产品"
}
```

**响应（非流式）**
```json
{
  "code": 0,
  "data": {
    "message_id": "msg_xyz789",
    "role": "assistant",
    "content": "以下是上个月销售额前10的产品：",
    "sql": "SELECT p.product_name, SUM(o.amount) as total_sales FROM products p JOIN orders o ON p.id = o.product_id WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) GROUP BY p.id ORDER BY total_sales DESC LIMIT 10",
    "result": {
      "columns": ["product_name", "total_sales"],
      "rows": [
        ["产品A", 150000.00],
        ["产品B", 120000.00],
        ["产品C", 95000.00]
      ],
      "total": 3,
      "truncated": false
    },
    "created_at": "2026-03-07T11:05:00Z"
  }
}
```

**响应（流式 SSE）**
```
event: thinking
data: {"status": "analyzing", "message": "正在分析您的问题..."}

event: thinking
data: {"status": "generating_sql", "message": "正在生成SQL查询..."}

event: sql
data: {"sql": "SELECT p.product_name, SUM(o.amount)..."}

event: result
data: {"columns": ["product_name", "total_sales"], "rows": [["产品A", 150000.00]]}

event: done
data: {"message": "查询完成"}
```

#### 4.3.3 获取对话历史

**请求**
```http
GET /api/sessions/{session_id}/messages?limit=20
```

**响应**
```json
{
  "code": 0,
  "data": {
    "session_id": "sess_abc123",
    "messages": [
      {
        "id": "msg_001",
        "role": "user",
        "content": "查询上个月销售额前10的产品",
        "created_at": "2026-03-07T11:00:00Z"
      },
      {
        "id": "msg_002",
        "role": "assistant",
        "content": "以下是上个月销售额前10的产品：",
        "sql": "SELECT ...",
        "created_at": "2026-03-07T11:00:05Z"
      },
      {
        "id": "msg_003",
        "role": "user",
        "content": "按地区拆分",
        "created_at": "2026-03-07T11:01:00Z"
      },
      {
        "id": "msg_004",
        "role": "assistant",
        "content": "以下是按地区拆分的销售额：",
        "sql": "SELECT ... GROUP BY region",
        "created_at": "2026-03-07T11:01:10Z"
      }
    ]
  }
}
```

### 4.4 错误响应

```json
{
  "code": 1001,
  "message": "数据库连接失败",
  "details": {
    "error": "Connection refused",
    "host": "192.168.1.100",
    "port": 3306
  }
}
```

**错误码定义**

| 错误码 | 说明 |
|-------|------|
| 1001 | 数据库连接失败 |
| 1002 | 数据库认证失败 |
| 1003 | 数据库不存在 |
| 1004 | Schema加载失败 |
| 2001 | SQL生成失败 |
| 2002 | SQL执行失败 |
| 2003 | 查询超时 |
| 2004 | 结果数量超限 |
| 3001 | 会话不存在 |
| 3002 | 会话已过期 |
| 4001 | 请求参数错误 |

---

## 5. 数据结构设计

### 5.1 内存数据结构

#### 5.1.1 数据源 (DataSource)

```python
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, List

class DatabaseType(Enum):
    MYSQL = "mysql"
    POSTGRESQL = "postgresql"
    SQLITE = "sqlite"

@dataclass
class DataSource:
    id: str                          # 数据源ID
    name: str                        # 显示名称
    type: DatabaseType               # 数据库类型
    host: str                        # 主机地址
    port: int                        # 端口
    database: str                    # 数据库名
    username: str                    # 用户名
    password: str                    # 密码（加密）
    schema_name: Optional[str]       # Schema名称（PostgreSQL）
    status: str                      # 状态: connected/disconnected
    created_at: datetime             # 创建时间

    # 运行时缓存
    _connection: Optional[object]    # 数据库连接池
    _schema_cache: Optional['SchemaInfo']  # Schema缓存
```

#### 5.1.2 Schema信息 (SchemaInfo)

```python
@dataclass
class ColumnInfo:
    name: str                # 列名
    type: str                # 数据类型
    nullable: bool           # 是否可空
    key: Optional[str]       # 键类型: PRI/MUL/UNI
    default: Optional[str]   # 默认值
    comment: Optional[str]   # 注释

@dataclass
class TableInfo:
    name: str                      # 表名
    comment: Optional[str]         # 表注释
    columns: List[ColumnInfo]      # 列信息
    primary_keys: List[str]        # 主键列
    foreign_keys: List['ForeignKey']  # 外键关系

@dataclass
class ForeignKey:
    name: str                 # 外键名
    columns: List[str]        # 本表列
    ref_table: str            # 引用表
    ref_columns: List[str]    # 引用列

@dataclass
class SchemaInfo:
    database: str                   # 数据库名
    tables: List[TableInfo]         # 表信息列表
    loaded_at: datetime             # 加载时间
```

#### 5.1.3 会话 (Session)

```python
@dataclass
class Message:
    id: str                         # 消息ID
    role: str                       # 角色: user/assistant
    content: str                    # 消息内容
    sql: Optional[str]              # 生成的SQL
    result: Optional['QueryResult'] # 查询结果
    error: Optional[str]            # 错误信息
    created_at: datetime            # 创建时间

@dataclass
class QueryResult:
    columns: List[str]              # 列名
    rows: List[List[Any]]           # 数据行
    total: int                      # 总行数
    truncated: bool                 # 是否截断
    execution_time: float           # 执行时间(秒)

@dataclass
class Session:
    id: str                         # 会话ID
    datasource_id: str              # 数据源ID
    messages: List[Message]         # 消息历史
    context: dict                   # 上下文信息
    created_at: datetime            # 创建时间
    last_active_at: datetime        # 最后活跃时间
```

#### 5.1.4 上下文 (Context)

```python
@dataclass
class QueryContext:
    """查询上下文，用于多轮对话"""
    last_sql: Optional[str]         # 上一次执行的SQL
    last_tables: List[str]          # 上一次涉及的表
    current_filters: dict           # 当前筛选条件
    current_group_by: List[str]     # 当前分组字段
    current_order_by: List[str]     # 当前排序字段
    mentioned_entities: List[str]   # 提及的实体(表/字段)
```

### 5.2 全局状态管理

```python
@dataclass
class AppState:
    """应用全局状态（内存存储）"""
    datasources: Dict[str, DataSource]    # 数据源映射
    sessions: Dict[str, Session]          # 会话映射

    # 全局配置
    max_result_rows: int = 1000           # 最大返回行数
    query_timeout: int = 30               # 查询超时(秒)
    max_context_messages: int = 10        # 最大上下文消息数
```

### 5.3 ER图（概念模型）

```
┌────────────────┐       ┌────────────────┐
│   DataSource   │       │     Session    │
├────────────────┤       ├────────────────┤
│ id (PK)        │       │ id (PK)        │
│ name           │       │ datasource_id  │───┐
│ type           │       │ created_at     │   │
│ host           │       │ last_active_at │   │
│ port           │       └────────────────┘   │
│ database       │              │             │
│ username       │              │             │
│ password       │              ▼             │
│ status         │       ┌────────────────┐   │
│ created_at     │       │    Message     │   │
└────────────────┘       ├────────────────┤   │
        │                │ id (PK)        │   │
        │                │ session_id (FK)│───┘
        ▼                │ role           │
┌────────────────┐       │ content        │
│   SchemaInfo   │       │ sql            │
├────────────────┤       │ result         │
│ database       │       │ created_at     │
│ tables[]       │       └────────────────┘
│ loaded_at      │
└────────────────┘
        │
        ▼
┌────────────────┐
│   TableInfo    │
├────────────────┤
│ name           │
│ comment        │
│ columns[]      │
│ primary_keys[] │
│ foreign_keys[] │
└────────────────┘
```

---

## 6. 技术架构设计

### 6.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React/Vue)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 数据源配置页面 │  │ 对话交互界面  │  │ 结果展示组件  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      API Layer                            │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │  │
│  │  │DataSource  │  │  Session   │  │  Message   │          │  │
│  │  │  Router    │  │  Router    │  │  Router    │          │  │
│  │  └────────────┘  └────────────┘  └────────────┘          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Service Layer                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │  │
│  │  │DataSource  │  │  Schema    │  │   Query    │          │  │
│  │  │  Service   │  │  Service   │  │  Service   │          │  │
│  │  └────────────┘  └────────────┘  └────────────┘          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   DeepAgents Layer                        │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              Text2SQL Agent                         │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │  │
│  │  │  │ Schema   │  │   SQL    │  │  Result  │          │  │  │
│  │  │  │  Tool    │  │  Tool    │  │  Tool    │          │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Database Layer                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │  │
│  │  │   MySQL    │  │ PostgreSQL │  │   SQLite   │          │  │
│  │  │  Driver    │  │  Driver    │  │  Driver    │          │  │
│  │  └────────────┘  └────────────┘  └────────────┘          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Databases                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   MySQL    │  │ PostgreSQL │  │   SQLite   │                │
│  │  Server    │  │  Server    │  │   File     │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 DeepAgents 智能体设计

```python
from deepagents import create_deep_agent
from typing import Literal

# Schema 探索工具
def explore_schema(
    datasource_id: str,
    table_pattern: str = None,
    column_pattern: str = None
) -> str:
    """
    探索数据库 Schema，支持模糊匹配表名和列名。

    Args:
        datasource_id: 数据源ID
        table_pattern: 表名匹配模式（支持通配符）
        column_pattern: 列名匹配模式（支持通配符）

    Returns:
        匹配的表结构信息（Markdown格式）
    """
    pass

# SQL 执行工具
def execute_sql(
    datasource_id: str,
    sql: str,
    limit: int = 1000
) -> dict:
    """
    执行 SQL 查询并返回结果。

    Args:
        datasource_id: 数据源ID
        sql: SQL 查询语句（仅支持 SELECT）
        limit: 最大返回行数

    Returns:
        查询结果，包含列名和数据行
    """
    pass

# 创建 Text2SQL Agent
text2sql_agent = create_deep_agent(
    name="text2sql",
    tools=[explore_schema, execute_sql],
    system_prompt="""
    你是一个专业的数据分析师助手。你的任务是帮助用户通过自然语言查询数据库。

    ## 工作流程

    1. **理解需求**：分析用户的问题，明确查询目标
    2. **探索Schema**：使用 explore_schema 工具了解表结构
    3. **生成SQL**：根据 Schema 信息生成正确的 SQL
    4. **执行查询**：使用 execute_sql 工具执行查询
    5. **解释结果**：用自然语言解释查询结果

    ## 注意事项

    - 只生成 SELECT 语句，禁止 DELETE/UPDATE/INSERT
    - 对于复杂查询，先写子查询或 CTE
    - 如果 Schema 信息不完整，主动探索相关表
    - 解释结果时突出关键数据和趋势
    - 如果用户追问，基于上下文修改 SQL

    ## 安全规则

    - 不查询敏感表（如用户密码表）
    - 不暴露敏感数据（如手机号、身份证）
    - 大结果集自动截断，提示用户添加筛选条件
    """,
    model="claude-sonnet-4-6"
)
```

---

## 7. 非功能性需求

### 7.1 性能要求

| 指标 | 目标值 | 说明 |
|-----|-------|------|
| API 响应时间 | < 200ms | 不含 AI 处理时间 |
| SQL 生成时间 | < 5s | 简单查询 |
| SQL 执行时间 | < 30s | 含查询超时控制 |
| 并发会话数 | 100 | 单实例支持 |
| Schema 加载 | < 3s | 中等规模数据库 |

### 7.2 安全要求

| 要求 | 说明 |
|-----|------|
| SQL 注入防护 | 只允许 SELECT 语句，禁止其他 DML/DDL |
| 敏感数据脱敏 | 密码、手机号等敏感数据自动脱敏 |
| 连接加密 | 数据库连接使用 SSL/TLS |
| 密码加密 | 数据库密码内存中加密存储 |

### 7.3 可用性要求

| 要求 | 说明 |
|-----|------|
| 错误提示 | 友好的错误信息，指导用户修正 |
| 查询建议 | 主动提供查询优化建议 |
| Schema 提示 | 输入时自动提示表名、字段名 |

---

## 8. 版本规划

### 8.1 v1.0（当前版本）

- [x] 数据源配置（MySQL/PostgreSQL/SQLite）
- [x] 自然语言转 SQL
- [x] 多轮对话
- [x] 查询结果展示

### 8.2 v1.1（规划中）

- [ ] 数据可视化（图表）
- [ ] 查询历史记录
- [ ] 查询收藏功能

### 8.3 v2.0（未来规划）

- [ ] 持久化存储
- [ ] 用户认证与权限管理
- [ ] 团队协作功能
- [ ] 自定义数据模型

---

## 9. 附录

### 9.1 参考文档

- [DeepAgents 框架文档](./参考文档/langchain-deepagents-docs.md)
- [Text2SQL 最佳实践](./参考文档/text2sql参考文档.md)

### 9.2 术语表

| 术语 | 定义 |
|-----|------|
| Schema | 数据库结构定义，包括表、列、关系等 |
| Text2SQL | 自然语言转 SQL 的技术 |
| DeepAgents | LangChain 推出的智能体框架 |
| 多轮对话 | 用户与系统进行连续的多轮问答交互 |

---

**文档结束**

---

## 10. 项目完成记录

### 10.1 开发完成状态

**完成日期**: 2026-03-07

**开发团队**:
| 角色 | 职责 |
|------|------|
| 产品经理 | 需求分析、PRD文档、API接口定义 |
| 后端工程师 | FastAPI项目、数据库模块、DeepAgents智能体、API实现 |
| 前端工程师 | React项目、数据源配置页面、对话交互界面、结果展示组件 |

### 10.2 交付物清单

**后端文件**:
```
app/
├── main.py                    # FastAPI主应用
├── core/
│   ├── config.py              # 配置管理
│   └── security.py            # 密码AES加密
├── models/
│   └── schemas.py             # Pydantic数据模型
├── routers/
│   ├── datasources.py         # 数据源管理API
│   └── sessions.py            # 会话管理API
└── services/
    ├── db_service.py          # 数据库连接服务
    ├── datasource_service.py  # 数据源管理服务
    ├── session_service.py     # 会话管理服务
    └── agent_service.py       # DeepAgents智能体服务
```

**前端文件**:
```
frontend/
└── src/
    ├── components/
    │   ├── Layout.tsx         # 布局组件
    │   └── DataTable.tsx      # 数据表格组件
    ├── pages/
    │   ├── DataSourcePage.tsx # 数据源列表页
    │   ├── NewDataSourcePage.tsx # 添加数据源页
    │   └── ChatPage.tsx       # 对话交互页
    ├── services/
    │   └── api.ts             # API客户端
    ├── store/
    │   └── index.ts           # Zustand状态管理
    └── types/
        └── index.ts           # TypeScript类型定义
```

### 10.3 功能验收清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 数据源配置 | ✅ 已完成 | 支持MySQL/PostgreSQL/SQLite |
| 连接测试 | ✅ 已完成 | 保存前验证连接有效性 |
| Schema获取 | ✅ 已完成 | 自动获取表结构信息 |
| 自然语言查询 | ✅ 已完成 | 基于DeepAgents实现 |
| 多轮对话 | ✅ 已完成 | 支持上下文理解 |
| 流式响应 | ✅ 已完成 | SSE实时返回处理状态 |
| 结果展示 | ✅ 已完成 | 表格展示、排序、分页 |
| 密码加密 | ✅ 已完成 | AES加密存储 |
| SQL安全 | ✅ 已完成 | 只允许SELECT语句 |

### 10.4 技术栈确认

**后端**:
- Python 3.10+
- FastAPI 0.115+
- SQLAlchemy 2.0+ (异步)
- DeepAgents / LangChain
- aiomysql, asyncpg, aiosqlite

**前端**:
- React 18
- TypeScript 5.3
- Vite 5.1
- TailwindCSS 3.4
- Zustand 4.5
- Axios 1.6