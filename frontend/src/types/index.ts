// 数据源相关类型
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite';

export interface DataSourceConfig {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schema_name?: string;
}

export interface DataSource extends DataSourceConfig {
  id: string;
  status: 'connected' | 'disconnected' | 'error';
  created_at: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key?: string;
  comment?: string;
}

export interface TableInfo {
  name: string;
  comment?: string;
  columns: ColumnInfo[];
}

export interface SchemaInfo {
  tables: TableInfo[];
}

// 会话相关类型
export interface Session {
  session_id: string;
  datasource_id: string;
  created_at: string;
}

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
  total: number;
  truncated: boolean;
}

// ==================== v2.2 简化内容块类型 ====================

// 内容块类型 - 只保留文本类型
export type ContentBlock = { type: 'text'; content: string };

// 消息类型 - 使用内容块
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  blocks: ContentBlock[];
  sql?: string;  // 保留用于调试
  thinking_process?: ThinkingEvent[];
  created_at: string;
  error?: string;
}

// API 响应类型
export interface ApiResponse<T> {
  code: number;
  data?: T;
  message?: string;
  details?: Record<string, unknown>;
}

// 错误类型
export interface ApiError {
  code: number;
  message: string;
  details?: Record<string, unknown>;
}

// SSE 事件类型 (v1.0)
export type SSEEventType = 'thinking' | 'sql' | 'result' | 'done' | 'error';

export interface SSEEvent {
  event: SSEEventType;
  data: {
    status?: string;
    message?: string;
    sql?: string;
    columns?: string[];
    rows?: (string | number | null)[][];
    error?: string;
  };
}

// ==================== v1.1 兼容类型 ====================

// 图表类型
export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'histogram' | 'area';

// 坐标轴类型
export type AxisType = 'category' | 'datetime' | 'number';

// 坐标轴配置
export interface AxisConfig {
  field: string;
  label: string;
  type: AxisType;
}

// 系列配置
export interface SeriesConfig {
  name: string;
  field: string;
  type: string;
}

// 图表选项
export interface ChartOptions {
  show_legend: boolean;
  show_data_labels: boolean;
  stacked: boolean;
}

// 可视化建议
export interface ChartSuggestion {
  chart_type: ChartType;
  title: string;
  x_axis: AxisConfig;
  y_axis: AxisConfig;
  series?: SeriesConfig[];
  options?: ChartOptions;
  confidence: number;
}

// 思考过程事件类型 (v2.2)
export type ThinkingEventType =
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'sql_generation'
  | 'sql_execution'
  | 'message'
  | 'error'
  | 'done';

// 思考过程事件
export interface ThinkingEvent {
  type: ThinkingEventType;
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: string;
  id?: string;
  sql?: string;
  status?: string;
  message?: string;
  error?: string;
}

// 分析洞察
export interface Insight {
  title: string;
  content: string;
  importance: 'high' | 'medium' | 'low';
}

// 分析结果
export interface AnalysisResult {
  insights: Insight[];
  recommendations: string[];
  data_used: string[];
}