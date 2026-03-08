import axios, { AxiosInstance } from 'axios';
import type {
  DataSource,
  DataSourceConfig,
  SchemaInfo,
  Session,
  Message,
  ApiResponse,
  ThinkingEvent,
  ContentBlock,
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

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          return Promise.reject(error.response.data);
        } else if (error.request) {
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

  async getDataSources(): Promise<DataSource[]> {
    const response = await this.client.get<ApiResponse<DataSource[]>>('/datasources');
    return response.data.data || [];
  }

  async addDataSource(config: DataSourceConfig): Promise<DataSource> {
    const response = await this.client.post<ApiResponse<DataSource>>('/datasources', config);
    if (response.data.code !== 0) {
      throw new Error(response.data.message || '添加数据源失败');
    }
    return response.data.data!;
  }

  async testDataSource(config: DataSourceConfig): Promise<{ success: boolean; message: string; version?: string }> {
    const response = await this.client.post<ApiResponse<{ success: boolean; message: string; version?: string }>>(
      '/datasources/test',
      config
    );
    return response.data.data!;
  }

  async deleteDataSource(id: string): Promise<void> {
    await this.client.delete(`/datasources/${id}`);
  }

  async getDataSourceSchema(id: string): Promise<SchemaInfo> {
    const response = await this.client.get<ApiResponse<SchemaInfo>>(`/datasources/${id}/schema`);
    return response.data.data!;
  }

  // ==================== 会话管理 ====================

  async createSession(datasourceId: string): Promise<Session> {
    const response = await this.client.post<ApiResponse<Session>>('/sessions', {
      datasource_id: datasourceId,
    });
    return response.data.data!;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`/sessions/${sessionId}`);
  }

  async getSessionMessages(sessionId: string, limit = 20): Promise<Message[]> {
    const response = await this.client.get<ApiResponse<{ messages: Message[] }>>(
      `/sessions/${sessionId}/messages`,
      { params: { limit } }
    );
    return response.data.data?.messages || [];
  }

  async sendMessage(sessionId: string, content: string): Promise<Message> {
    const response = await this.client.post<ApiResponse<Message>>(
      `/sessions/${sessionId}/messages`,
      { content }
    );
    return response.data.data!;
  }

  /** 发送消息 (流式 SSE) - v2.2 简化版 */
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
    const blocks: ContentBlock[] = [];
    let sql = '';
    let error = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEventType = line.slice(6).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            const event = { type: currentEventType, ...data } as ThinkingEvent;
            events.push(event);
            callbacks.onEvent?.(event);

            switch (currentEventType) {
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

              case 'message':
                if (data.content) {
                  // v2.2: 只处理文本内容
                  blocks.push({ type: 'text', content: data.content });
                }
                break;

              case 'error':
                error = data.message || '处理失败';
                callbacks.onError?.(error);
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    const finalMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      blocks,
      sql: sql || undefined,
      thinking_process: events,
      created_at: new Date().toISOString(),
      error: error || undefined,
    };

    callbacks.onDone?.(finalMessage);
    return finalMessage;
  }
}

export const apiService = new ApiService();
export default apiService;