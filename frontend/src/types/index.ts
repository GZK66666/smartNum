// API Types
export interface ApiResponse<T = unknown> {
  code: number
  data?: T
  message?: string
  next_cursor?: string
  has_more?: boolean
}

// Auth Types
export interface User {
  user_id: string
  username: string
  email: string | null
  status: number
}

export interface AuthResponse {
  user_id: string
  username: string
  email: string | null
  access_token: string
  token_type: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email?: string
}

// DataSource Types
export interface DataSource {
  id: string
  name: string
  type: string
  host: string
  port: number
  database: string
  status: string
  created_at: string
}

export interface DataSourceCreate {
  name: string
  type: 'mysql' | 'postgresql' | 'sqlite'
  host: string
  port: number
  database: string
  username: string
  password: string
  schema_name?: string
}

export interface TableInfo {
  name: string
  comment?: string
  columns: ColumnInfo[]
  primary_keys: string[]
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  key?: string
  comment?: string
}

// Session Types
export interface Session {
  id: string
  datasource_id: string
  datasource_name: string
  title: string | null
  message_count: number
  created_at: string
  last_active_at: string
}

export interface SessionCreate {
  datasource_id: string
}

// Message Types
export interface Message {
  id: string
  role: 'user' | 'assistant'
  blocks: MessageBlock[]
  sql?: string
  result?: QueryResult
  agentSteps?: AgentStep[]
  created_at: string
}

export interface MessageBlock {
  type: 'text' | 'code'
  content: string
  language?: string
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  total: number
  truncated: boolean
  execution_time?: number
}

export interface MessageCreate {
  content: string
}

// SSE Event Types
export interface SSEMessage {
  type: 'content' | 'sql' | 'result' | 'thinking' | 'error' | 'done'
  content?: string
  sql?: string
  result?: QueryResult
  error?: string
}

// Agent Step Event Types (from backend agent_service.py)
export type AgentEventType =
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'sql_generation'
  | 'sql_execution'
  | 'message'
  | 'error'
  | 'done'

export interface AgentStepEvent {
  type: AgentEventType
  step_id?: string
  name?: string  // 后端提供的显示名称
  content?: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  details?: string
  timestamp?: string
  sql?: string
  result?: QueryResult
  error?: string
  // 工具调用相关
  tool?: string
  input?: Record<string, unknown>
  output?: string
  id?: string
}

export interface AgentStep {
  id: string
  type: AgentEventType
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  content?: string
  details?: string
  sql?: string
  result?: QueryResult
  tool?: string
  timestamp: number
  // 后端存储的原始字段
  input?: Record<string, unknown> | string
  output?: string
}