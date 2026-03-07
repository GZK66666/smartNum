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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  result?: QueryResult;
  error?: string;
  created_at: string;
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

// SSE 事件类型
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