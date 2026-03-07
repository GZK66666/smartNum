import axios, { AxiosInstance } from 'axios';
import type {
  DataSource,
  DataSourceConfig,
  SchemaInfo,
  Session,
  Message,
  ApiResponse,
  ThinkingEvent,
} from '@/types';

const API_BASE = '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error
          return Promise.reject(error.response.data);
        } else if (error.request) {
          // No response received
          return Promise.reject({
            code: -1,
            message: '无法连接到服务器，请检查网络连接',
          });
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== 数据源管理 ====================

  /** 获取数据源列表 */
  async getDataSources(): Promise<DataSource[]> {
    const response = await this.client.get<ApiResponse<DataSource[]>>('/datasources');
    return response.data.data || [];
  }

  /** 添加数据源 */
  async addDataSource(config: DataSourceConfig): Promise<DataSource> {
    const response = await this.client.post<ApiResponse<DataSource>>('/datasources', config);
    if (response.data.code !== 0) {
      throw new Error(response.data.message || '添加数据源失败');
    }
    return response.data.data!;
  }

  /** 测试数据源连接 */
  async testDataSource(config: DataSourceConfig): Promise<{ success: boolean; message: string; version?: string }> {
    const response = await this.client.post<ApiResponse<{ success: boolean; message: string; version?: string }>>(
      '/datasources/test',
      config
    );
    return response.data.data!;
  }

  /** 删除数据源 */
  async deleteDataSource(id: string): Promise<void> {
    await this.client.delete(`/datasources/${id}`);
  }

  /** 获取数据源 Schema */
  async getDataSourceSchema(id: string): Promise<SchemaInfo> {
    const response = await this.client.get<ApiResponse<SchemaInfo>>(`/datasources/${id}/schema`);
    return response.data.data!;
  }

  // ==================== 会话管理 ====================

  /** 创建会话 */
  async createSession(datasourceId: string): Promise<Session> {
    const response = await this.client.post<ApiResponse<Session>>('/sessions', {
      datasource_id: datasourceId,
    });
    return response.data.data!;
  }

  /** 删除会话 */
  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`/sessions/${sessionId}`);
  }

  /** 获取会话历史消息 */
  async getSessionMessages(sessionId: string, limit = 20): Promise<Message[]> {
    const response = await this.client.get<ApiResponse<{ messages: Message[] }>>(
      `/sessions/${sessionId}/messages`,
      { params: { limit } }
    );
    return response.data.data?.messages || [];
  }

  /** 发送消息 (非流式) */
  async sendMessage(sessionId: string, content: string): Promise<Message> {
    const response = await this.client.post<ApiResponse<Message>>(
      `/sessions/${sessionId}/messages`,
      { content }
    );
    return response.data.data!;
  }

  /** 发送消息 (流式 SSE) - 返回完整消息 */
  async sendMessageStream(
    sessionId: string,
    content: string,
    callbacks: {
      onEvent?: (event: ThinkingEvent) => void;
      onThinking?: (message: string) => void;
      onDone?: (message: Message) => void;
      onError?: (error: string) => void;
    }
  ): Promise<Message> {
    const url = `${API_BASE}/sessions/${sessionId}/messages/stream`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = `HTTP ${response.status}`;
      callbacks.onError?.(error);
      throw new Error(error);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';
    const events: ThinkingEvent[] = [];
    let finalMessage: Message | null = null;

    // 用于构建最终消息
    let messageContent = '';
    let sql = '';
    let result: Message['result'] = undefined;
    let visualization: Message['visualization'] = undefined;
    let analysis: Message['analysis'] = undefined;
    let agentType: Message['agent_type'] = 'text2sql';
    let error = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // 解析事件类型
        if (line.startsWith('event:')) {
          currentEventType = line.slice(6).trim();
          continue;
        }

        // 解析事件数据
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            const event = { type: currentEventType, ...data } as ThinkingEvent;

            // 添加到事件列表
            events.push(event);

            // 调用回调
            callbacks.onEvent?.(event);

            // 根据事件类型处理
            switch (currentEventType) {
              case 'route':
                agentType = data.agent || 'text2sql';
                callbacks.onThinking?.(`路由到 ${agentType} 智能体...`);
                break;

              case 'thinking':
                callbacks.onThinking?.(data.content || '思考中...');
                break;

              case 'tool_call':
                callbacks.onThinking?.(`调用工具: ${data.tool}`);
                break;

              case 'sql_generation':
                sql = data.sql || '';
                callbacks.onThinking?.('已生成 SQL');
                break;

              case 'visualization':
                visualization = data.suggestion;
                break;

              case 'result':
                result = {
                  columns: data.columns || [],
                  rows: data.rows || [],
                  total: data.total || 0,
                  truncated: data.truncated || false,
                };
                break;

              case 'message':
                messageContent = data.content || '';
                break;

              case 'analysis':
                analysis = {
                  insights: data.insights || [],
                  recommendations: data.recommendations || [],
                  data_used: [],
                };
                break;

              case 'error':
                error = data.message || '处理失败';
                callbacks.onError?.(error);
                break;

              case 'done':
                // 最后的 done 事件可能包含完整的 message 数据
                if (data.data) {
                  finalMessage = {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: data.data.content || messageContent,
                    sql: data.data.sql || sql,
                    result: data.data.result || result,
                    error: data.data.error || error || undefined,
                    thinking_process: events,
                    visualization: data.data.visualization || visualization,
                    analysis: data.data.analysis || analysis,
                    agent_type: data.data.agent_type || agentType,
                    created_at: new Date().toISOString(),
                  };
                } else {
                  finalMessage = {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: messageContent,
                    sql: sql || undefined,
                    result: result,
                    error: error || undefined,
                    thinking_process: events,
                    visualization: visualization,
                    analysis: analysis,
                    agent_type: agentType,
                    created_at: new Date().toISOString(),
                  };
                }
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    // 如果没有收到 done 事件，手动构建消息
    if (!finalMessage) {
      finalMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: messageContent,
        sql: sql || undefined,
        result: result,
        error: error || undefined,
        thinking_process: events,
        visualization: visualization,
        analysis: analysis,
        agent_type: agentType,
        created_at: new Date().toISOString(),
      };
    }

    callbacks.onDone?.(finalMessage);
    return finalMessage;
  }
}

export const apiService = new ApiService();
export default apiService;