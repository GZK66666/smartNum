# 智能问数系统 (smartNum) 产品需求文档

**版本**: 1.1
**日期**: 2026-03-07
**作者**: 产品经理

---

## 1. 版本概述

### 1.1 版本目标

v1.1 版本在 v1.0 基础上，重点提升用户体验和系统能力：

| 升级点 | 目标 | 价值 |
|-------|------|------|
| 数据可视化 | 查询结果智能图表展示 | 降低数据理解门槛 |
| 数据导出 | 支持 CSV/Excel 导出 | 便于数据分享和二次分析 |
| 实时思考过程 | 展示智能体中间处理过程 | 增强用户信任感 |
| 泛化智能体 | 支持非问数问题 | 提升系统通用性 |

### 1.2 版本范围

| 功能 | v1.0 | v1.1 |
|-----|------|------|
| 自然语言转 SQL | ✅ | ✅ |
| 多轮对话 | ✅ | ✅ |
| 数据源配置 | ✅ | ✅ |
| 查询结果展示 | ✅ | ✅ |
| 数据可视化 | ❌ | ✅ |
| 数据导出 | ❌ | ✅ |
| 实时思考过程 | ❌ | ✅ |
| 泛化智能体 | ❌ | ✅ |

---

## 2. 功能需求详述

### 2.1 数据可视化

#### 2.1.1 功能描述

系统自动分析用户问题的可视化意图，并智能推荐图表类型，将查询结果以图表形式展示。

#### 2.1.2 可视化意图识别

**意图类型**：

| 意图类型 | 示例问题 | 推荐图表 |
|---------|---------|---------|
| 趋势分析 | "查询最近一年的销售额趋势" | 折线图 |
| 对比分析 | "各地区的销售额对比" | 柱状图 |
| 占比分析 | "各产品类别的销售占比" | 饼图 |
| 分布分析 | "用户年龄分布" | 直方图 |
| 排名分析 | "销售额前10的产品" | 横向柱状图 |
| 关联分析 | "广告投入与销售额的关系" | 散点图 |

**识别规则**：

```python
# 可视化意图识别规则
VISUALIZATION_PATTERNS = {
    "trend": ["趋势", "变化", "走势", "增长", "下降", "随时间"],
    "comparison": ["对比", "比较", "各", "每个", "不同"],
    "proportion": ["占比", "比例", "百分比", "分布", "构成"],
    "ranking": ["前", "排名", "最多", "最少", "TOP"],
    "distribution": ["分布", "区间", "年龄段", "价格段"],
    "correlation": ["关系", "相关", "影响", "随着"]
}
```

#### 2.1.3 图表类型定义

```typescript
interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'histogram' | 'area';
  title: string;
  xAxis: {
    field: string;
    label: string;
    type: 'category' | 'datetime' | 'number';
  };
  yAxis: {
    field: string;
    label: string;
    type: 'number';
  };
  series: {
    name: string;
    field: string;
    type: string;
  }[];
  options: {
    showLegend: boolean;
    showDataLabels: boolean;
    stacked: boolean;
  };
}
```

#### 2.1.4 交互功能

- **图表切换**：用户可手动切换图表类型
- **数据筛选**：图表支持数据筛选
- **图表下载**：支持导出为 PNG/SVG
- **全屏查看**：支持全屏模式

#### 2.1.5 展示逻辑

```
查询结果返回
    │
    ▼
判断数据特征
    │
    ├── 单维度聚合 → 柱状图/饼图
    ├── 时间序列 → 折线图
    ├── 多维度对比 → 分组柱状图
    ├── 数值分布 → 直方图
    └── 无明显特征 → 默认表格
    │
    ▼
生成图表配置
    │
    ▼
前端渲染图表
```

---

### 2.2 数据导出

#### 2.2.1 功能描述

用户可将查询结果导出为 CSV 或 Excel 格式，便于数据分享和二次分析。

#### 2.2.2 导出格式

| 格式 | 说明 | 适用场景 |
|-----|------|---------|
| CSV | 逗号分隔值文件 | 数据量小、简单数据 |
| Excel | .xlsx 格式 | 需要格式化、多工作表 |

#### 2.2.3 导出限制

| 限制项 | 限制值 | 说明 |
|-------|-------|------|
| 最大行数 | 100,000 | 防止内存溢出 |
| 最大列数 | 100 | 防止文件过大 |
| 文件大小 | 50MB | 浏览器下载限制 |

#### 2.2.4 导出流程

```
用户点击"导出"按钮
    │
    ▼
选择导出格式 (CSV/Excel)
    │
    ▼
前端生成文件
    │
    ├── CSV: 使用 PapaParse 库
    └── Excel: 使用 xlsx 库
    │
    ▼
触发浏览器下载
```

#### 2.2.5 Excel 导出特性

- 自动设置列宽
- 首行冻结
- 自动筛选
- 数值格式化（保留2位小数）
- 日期格式化

---

### 2.3 实时思考过程

#### 2.3.1 功能描述

在智能体处理用户问题时，实时展示其思考过程、工具调用等中间步骤，增强用户信任感。

#### 2.3.2 思考过程类型

| 类型 | 说明 | 示例 |
|-----|------|------|
| thinking | 智能体思考 | "正在分析您的问题..." |
| tool_call | 工具调用 | "正在查询数据库 Schema..." |
| tool_result | 工具结果 | "找到 3 个相关表" |
| sql_generation | SQL 生成 | "正在生成 SQL 查询..." |
| sql_execution | SQL 执行 | "正在执行查询..." |

#### 2.3.3 SSE 事件格式

```
event: thinking
data: {"type": "thinking", "content": "正在分析您的问题，识别查询意图..."}

event: tool_call
data: {"type": "tool_call", "tool": "explore_schema", "input": {"table_pattern": "order"}}

event: tool_result
data: {"type": "tool_result", "tool": "explore_schema", "output": "找到表: orders, order_items"}

event: sql_generation
data: {"type": "sql_generation", "sql": "SELECT * FROM orders WHERE..."}

event: sql_execution
data: {"type": "sql_execution", "status": "running", "duration": 0.5}

event: result
data: {"type": "result", "columns": [...], "rows": [...]}

event: done
data: {"type": "done", "message": "查询完成"}
```

#### 2.3.4 前端展示设计

```
┌────────────────────────────────────────────────────────────┐
│  用户: 查询上个月销售额前10的产品                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  智能体思考过程                                    [展开/收起] │
├────────────────────────────────────────────────────────────┤
│  💭 正在分析您的问题，识别查询意图...                        │
│  🔧 调用工具: explore_schema                                │
│     └─ 找到表: products, orders, order_items               │
│  🔧 调用工具: execute_sql                                   │
│     └─ 执行 SQL: SELECT p.name, SUM(o.amount)...           │
│  ✅ 查询完成，返回 10 条记录                                 │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  查询结果                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [表格] [图表]  │ 导出 ▼                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```

#### 2.3.5 交互设计

- **默认收起**：思考过程默认收起，不干扰主要信息
- **点击展开**：用户可点击展开查看详细过程
- **实时更新**：思考过程实时更新，有动画效果
- **步骤高亮**：当前执行步骤高亮显示

---

### 2.4 泛化智能体

#### 2.4.1 功能描述

系统支持处理非问数类问题，如闲聊、数据分析、建议等，提升系统通用性。

#### 2.4.2 问题类型分类

| 类型 | 说明 | 示例 |
|-----|------|------|
| text2sql | 数据库查询 | "查询上个月的销售额" |
| chitchat | 闲聊 | "你好"、"你是谁" |
| data_analysis | 数据分析 | "帮我分析一下销售趋势" |
| suggestion | 建议 | "如何提高销售额" |
| clarification | 澄清 | "你说的销售额是指订单金额吗" |

#### 2.4.3 智能体架构

```
                    ┌─────────────────┐
                    │   用户问题      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  路由智能体      │
                    │ (Router Agent)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │ Text2SQL    │ │ 闲聊智能体   │ │ 分析智能体   │
     │   Agent     │ │(Chitchat)   │ │ (Analysis)  │
     └─────────────┘ └─────────────┘ └─────────────┘
```

#### 2.4.4 路由智能体设计

```python
from deepagents import create_deep_agent
from typing import Literal

def route_question(question: str, context: dict) -> Literal["text2sql", "chitchat", "analysis"]:
    """
    路由用户问题到对应的智能体。

    Args:
        question: 用户问题
        context: 对话上下文

    Returns:
        目标智能体类型
    """
    pass

router_agent = create_deep_agent(
    name="router",
    tools=[route_question],
    system_prompt="""
    你是一个问题路由器。分析用户问题，判断应该由哪个智能体处理。

    ## 路由规则

    1. **text2sql**: 用户需要查询数据库中的数据
       - 包含查询、统计、汇总等关键词
       - 需要从数据库获取信息

    2. **chitchat**: 闲聊或问候
       - 问候语、自我介绍
       - 不需要数据库的简单对话

    3. **analysis**: 数据分析或建议
       - 需要基于已有数据进行分析
       - 需要提供建议或洞察

    ## 注意事项

    - 如果不确定，默认路由到 text2sql
    - 考虑对话上下文，可能需要追问澄清
    """,
    model="claude-haiku-4-5"
)
```

#### 2.4.5 各智能体职责

**Text2SQL Agent** (已有):
- 处理数据库查询问题
- 生成并执行 SQL
- 返回查询结果

**Chitchat Agent** (新增):
- 处理问候和闲聊
- 提供友好的对话体验
- 引导用户使用系统功能

**Analysis Agent** (新增):
- 基于查询结果进行数据分析
- 提供数据洞察和建议
- 支持趋势分析、异常检测等

#### 2.4.6 对话流程

```
用户输入问题
    │
    ▼
路由智能体判断问题类型
    │
    ├── text2sql → Text2SQL Agent → 查询数据库 → 返回结果
    │
    ├── chitchat → Chitchat Agent → 生成回复 → 返回文本
    │
    └── analysis → Analysis Agent → 分析数据 → 返回洞察
    │
    ▼
返回给用户
```

---

## 3. 用户交互流程

### 3.1 数据可视化流程

```
用户输入问题
    │
    ▼
系统执行查询
    │
    ▼
返回查询结果 + 可视化建议
    │
    ├── 有可视化建议 → 自动渲染图表
    │                   │
    │                   ├── 用户满意 → 结束
    │                   │
    │                   └── 用户切换图表类型 → 重新渲染
    │
    └── 无可视化建议 → 显示表格
                       │
                       └── 用户手动选择图表 → 渲染图表
```

### 3.2 数据导出流程

```
用户查看查询结果
    │
    ▼
点击"导出"按钮
    │
    ▼
选择导出格式
    │
    ├── CSV → 前端生成 CSV → 下载
    │
    └── Excel → 前端生成 Excel → 下载
```

### 3.3 完整对话流程（含思考过程）

```
用户输入问题
    │
    ▼
前端显示"正在思考..."
    │
    ▼
SSE 接收思考过程事件
    │
    ├── thinking → 显示思考内容
    ├── tool_call → 显示工具调用
    ├── tool_result → 显示工具结果
    ├── sql_generation → 显示 SQL
    └── result → 显示结果
    │
    ▼
前端渲染结果
    │
    ├── 表格展示
    ├── 图表展示（如有可视化建议）
    └── 导出按钮
```

### 3.4 泛化智能体流程

```
用户输入问题
    │
    ▼
路由智能体判断类型
    │
    ├── 数据查询 → Text2SQL Agent
    │                │
    │                ├── 探索 Schema
    │                ├── 生成 SQL
    │                ├── 执行查询
    │                └── 返回结果 + 可视化建议
    │
    ├── 闲聊 → Chitchat Agent
    │            │
    │            └── 返回友好回复
    │
    └── 数据分析 → Analysis Agent
                   │
                   ├── 获取相关数据
                   ├── 分析数据
                   └── 返回洞察和建议
```

---

## 4. API 接口文档

### 4.1 新增接口概览

| 接口 | 方法 | 路径 | 说明 |
|-----|------|------|------|
| 发送消息（增强） | POST | /api/sessions/{id}/messages | 支持思考过程和可视化建议 |

### 4.2 发送消息接口（增强）

#### 4.2.1 请求

```http
POST /api/sessions/{session_id}/messages
Content-Type: application/json

{
  "content": "查询上个月销售额前10的产品"
}
```

#### 4.2.2 响应（流式 SSE）

```
event: route
data: {"type": "route", "agent": "text2sql", "confidence": 0.95}

event: thinking
data: {"type": "thinking", "content": "正在分析您的问题，识别查询意图..."}

event: tool_call
data: {
  "type": "tool_call",
  "tool": "explore_schema",
  "input": {"table_pattern": "order"},
  "id": "call_001"
}

event: tool_result
data: {
  "type": "tool_result",
  "tool": "explore_schema",
  "id": "call_001",
  "output": "找到表: orders, order_items"
}

event: sql_generation
data: {
  "type": "sql_generation",
  "sql": "SELECT p.product_name, SUM(o.amount) as total_sales FROM products p JOIN orders o ON p.id = o.product_id WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) GROUP BY p.id ORDER BY total_sales DESC LIMIT 10"
}

event: sql_execution
data: {"type": "sql_execution", "status": "running"}

event: sql_execution
data: {"type": "sql_execution", "status": "completed", "duration": 0.35}

event: visualization
data: {
  "type": "visualization",
  "suggestion": {
    "chart_type": "bar",
    "title": "上个月销售额前10的产品",
    "x_axis": {"field": "product_name", "label": "产品名称", "type": "category"},
    "y_axis": {"field": "total_sales", "label": "销售额", "type": "number"},
    "confidence": 0.9
  }
}

event: result
data: {
  "type": "result",
  "columns": ["product_name", "total_sales"],
  "rows": [
    ["产品A", 150000.00],
    ["产品B", 120000.00],
    ["产品C", 95000.00]
  ],
  "total": 10,
  "truncated": false
}

event: done
data: {"type": "done", "message": "查询完成"}
```

### 4.3 SSE 事件类型定义

```typescript
interface SSEEvent {
  type: 'route' | 'thinking' | 'tool_call' | 'tool_result' |
        'sql_generation' | 'sql_execution' | 'visualization' |
        'result' | 'error' | 'done';
  [key: string]: any;
}

interface RouteEvent extends SSEEvent {
  type: 'route';
  agent: 'text2sql' | 'chitchat' | 'analysis';
  confidence: number;
}

interface ThinkingEvent extends SSEEvent {
  type: 'thinking';
  content: string;
}

interface ToolCallEvent extends SSEEvent {
  type: 'tool_call';
  tool: string;
  input: object;
  id: string;
}

interface ToolResultEvent extends SSEEvent {
  type: 'tool_result';
  tool: string;
  id: string;
  output: string;
}

interface VisualizationEvent extends SSEEvent {
  type: 'visualization';
  suggestion: ChartSuggestion;
}

interface ChartSuggestion {
  chart_type: 'line' | 'bar' | 'pie' | 'scatter' | 'histogram';
  title: string;
  x_axis: {
    field: string;
    label: string;
    type: 'category' | 'datetime' | 'number';
  };
  y_axis: {
    field: string;
    label: string;
    type: 'number';
  };
  confidence: number;
}

interface ResultEvent extends SSEEvent {
  type: 'result';
  columns: string[];
  rows: any[][];
  total: number;
  truncated: boolean;
}
```

### 4.4 闲聊响应示例

```
event: route
data: {"type": "route", "agent": "chitchat", "confidence": 0.98}

event: thinking
data: {"type": "thinking", "content": "这是一个问候，我来友好地回应..."}

event: message
data: {
  "type": "message",
  "content": "你好！我是 smartNum 智能问数助手。我可以帮你查询数据库中的数据，只需要用自然语言描述你想了解的信息即可。比如你可以问我：\"查询上个月的销售额\"或\"统计各地区的订单数量\"。有什么我可以帮你的吗？"
}

event: done
data: {"type": "done", "message": "回复完成"}
```

### 4.5 数据分析响应示例

```
event: route
data: {"type": "route", "agent": "analysis", "confidence": 0.85}

event: thinking
data: {"type": "thinking", "content": "用户需要数据分析，我先获取相关数据..."}

event: tool_call
data: {"type": "tool_call", "tool": "get_sales_trend", "id": "call_001"}

event: tool_result
data: {"type": "tool_result", "tool": "get_sales_trend", "id": "call_001", "output": "..."}

event: analysis
data: {
  "type": "analysis",
  "insights": [
    {
      "title": "销售趋势",
      "content": "近3个月销售额呈上升趋势，月均增长率为12%",
      "importance": "high"
    },
    {
      "title": "异常点",
      "content": "2月15日销售额异常下降，可能与促销活动结束有关",
      "importance": "medium"
    }
  ],
  "recommendations": [
    "建议增加促销活动频次",
    "关注2月中旬的销售情况"
  ]
}

event: done
data: {"type": "done", "message": "分析完成"}
```

---

## 5. 数据结构设计

### 5.1 新增数据结构

#### 5.1.1 可视化建议 (VisualizationSuggestion)

```python
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class ChartType(Enum):
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    SCATTER = "scatter"
    HISTOGRAM = "histogram"
    AREA = "area"

@dataclass
class AxisConfig:
    field: str           # 字段名
    label: str           # 显示标签
    type: str            # 类型: category/datetime/number

@dataclass
class SeriesConfig:
    name: str            # 系列名称
    field: str           # 数据字段
    type: str            # 系列类型

@dataclass
class ChartOptions:
    show_legend: bool = True
    show_data_labels: bool = False
    stacked: bool = False

@dataclass
class VisualizationSuggestion:
    chart_type: ChartType
    title: str
    x_axis: AxisConfig
    y_axis: AxisConfig
    series: List[SeriesConfig]
    options: ChartOptions
    confidence: float    # 置信度 0-1
```

#### 5.1.2 思考过程事件 (ThinkingEvent)

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Any

class EventType(Enum):
    ROUTE = "route"
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    SQL_GENERATION = "sql_generation"
    SQL_EXECUTION = "sql_execution"
    VISUALIZATION = "visualization"
    RESULT = "result"
    MESSAGE = "message"
    ANALYSIS = "analysis"
    ERROR = "error"
    DONE = "done"

@dataclass
class ThinkingEvent:
    type: EventType
    content: Optional[str] = None
    tool: Optional[str] = None
    input: Optional[dict] = None
    output: Optional[str] = None
    id: Optional[str] = None
    sql: Optional[str] = None
    status: Optional[str] = None
    duration: Optional[float] = None
    suggestion: Optional[VisualizationSuggestion] = None
    agent: Optional[str] = None
    confidence: Optional[float] = None
    insights: Optional[List[dict]] = None
    recommendations: Optional[List[str]] = None
    columns: Optional[List[str]] = None
    rows: Optional[List[List[Any]]] = None
    total: Optional[int] = None
    truncated: Optional[bool] = None
    message: Optional[str] = None
    timestamp: datetime = None
```

#### 5.1.3 路由结果 (RouteResult)

```python
from dataclasses import dataclass
from enum import Enum

class AgentType(Enum):
    TEXT2SQL = "text2sql"
    CHITCHAT = "chitchat"
    ANALYSIS = "analysis"

@dataclass
class RouteResult:
    agent: AgentType
    confidence: float
    reason: Optional[str] = None
```

#### 5.1.4 分析结果 (AnalysisResult)

```python
from dataclasses import dataclass
from typing import List

@dataclass
class Insight:
    title: str
    content: str
    importance: str  # high/medium/low

@dataclass
class AnalysisResult:
    insights: List[Insight]
    recommendations: List[str]
    data_used: List[str]  # 使用的数据表/字段
```

### 5.2 扩展现有数据结构

#### 5.2.1 Message 扩展

```python
@dataclass
class Message:
    id: str
    role: str
    content: str
    sql: Optional[str] = None
    result: Optional['QueryResult'] = None
    error: Optional[str] = None
    created_at: datetime

    # v1.1 新增字段
    thinking_process: Optional[List[ThinkingEvent]] = None  # 思考过程
    visualization: Optional[VisualizationSuggestion] = None  # 可视化建议
    analysis: Optional[AnalysisResult] = None               # 分析结果
    agent_type: Optional[str] = None                        # 处理的智能体类型
```

---

## 6. 前端组件设计

### 6.1 新增组件

#### 6.1.1 图表组件 (ChartViewer)

```typescript
interface ChartViewerProps {
  data: {
    columns: string[];
    rows: any[][];
  };
  suggestion: ChartSuggestion;
  onChartTypeChange?: (type: string) => void;
  onExport?: (format: 'png' | 'svg') => void;
}
```

**功能**：
- 根据 suggestion 渲染图表
- 支持图表类型切换
- 支持图表导出

#### 6.1.2 思考过程组件 (ThinkingProcess)

```typescript
interface ThinkingProcessProps {
  events: ThinkingEvent[];
  collapsed?: boolean;
  onToggle?: () => void;
}
```

**功能**：
- 展示思考过程事件列表
- 支持展开/收起
- 实时更新动画

#### 6.1.3 导出按钮组件 (ExportButton)

```typescript
interface ExportButtonProps {
  data: {
    columns: string[];
    rows: any[][];
  };
  filename?: string;
  formats?: ('csv' | 'excel')[];
}
```

**功能**：
- 导出 CSV
- 导出 Excel
- 下载进度提示

### 6.2 组件交互

```
┌─────────────────────────────────────────────────────────────┐
│ ChatPage                                                    │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ MessageList                                            │  │
│  │  ├── Message (user)                                    │  │
│  │  └── Message (assistant)                               │  │
│  │       ├── ThinkingProcess (可展开)                     │  │
│  │       ├── ResultView                                   │  │
│  │       │   ├── TabPanel                                 │  │
│  │       │   │   ├── DataTable                            │  │
│  │       │   │   └── ChartViewer                          │  │
│  │       │   └── ExportButton                             │  │
│  │       └── AnalysisView (如有)                          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ InputArea                                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 技术实现要点

### 7.1 数据可视化

**技术选型**：
- 图表库：ECharts 或 Recharts
- 推荐使用 ECharts，功能更丰富

**实现要点**：
1. 后端分析用户问题和数据特征，生成可视化建议
2. 前端根据建议渲染图表
3. 支持用户手动切换图表类型

### 7.2 数据导出

**技术选型**：
- CSV：PapaParse
- Excel：xlsx (SheetJS)

**实现要点**：
1. 纯前端实现，无需后端支持
2. 大数据量时提示用户
3. Excel 支持格式化

### 7.3 实时思考过程

**技术选型**：
- SSE (Server-Sent Events)
- 与 v1.0 流式响应架构一致

**实现要点**：
1. 后端在智能体执行过程中发送事件
2. 前端实时接收并渲染
3. 支持展开/收起

### 7.4 泛化智能体

**技术选型**：
- DeepAgents 框架
- 路由智能体 + 专用智能体

**实现要点**：
1. 路由智能体快速判断问题类型
2. 根据类型分发到对应智能体
3. 各智能体独立处理，互不干扰

---

## 8. 开发任务分解

### 8.1 后端任务

| 任务 | 负责人 | 依赖 | 说明 |
|-----|-------|------|------|
| 泛化智能体改造 | 后端工程师 | 无 | 实现路由智能体和专用智能体 |
| 可视化建议生成 | 后端工程师 | 无 | 分析数据特征，生成图表建议 |
| SSE 事件增强 | 后端工程师 | 无 | 增加思考过程事件 |
| 数据导出接口 | 后端工程师 | 无 | 可选，大数据量时后端导出 |

### 8.2 前端任务

| 任务 | 负责人 | 依赖 | 说明 |
|-----|-------|------|------|
| 图表组件开发 | 前端工程师 | 无 | ECharts 封装 |
| 思考过程组件 | 前端工程师 | 无 | 展示 SSE 事件 |
| 导出功能实现 | 前端工程师 | 无 | CSV/Excel 导出 |
| SSE 事件处理 | 前端工程师 | 无 | 处理新增事件类型 |

---

## 9. 验收标准

### 9.1 数据可视化

- [ ] 系统能自动识别可视化意图
- [ ] 图表正确渲染
- [ ] 支持图表类型切换
- [ ] 支持图表导出

### 9.2 数据导出

- [ ] CSV 导出正确
- [ ] Excel 导出正确
- [ ] 大数据量有提示

### 9.3 实时思考过程

- [ ] 思考过程实时显示
- [ ] 支持展开/收起
- [ ] 事件顺序正确

### 9.4 泛化智能体

- [ ] 路由判断准确
- [ ] 闲聊回复友好
- [ ] 数据分析有洞察

---

**文档结束**