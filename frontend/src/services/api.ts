import axios, { AxiosInstance } from 'axios';
import type {
  DataSource,
  DataSourceConfig,
  SchemaInfo,
  Session,
  Message,
  ApiResponse,
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

  /** 发送消息 (流式 SSE) */
  sendMessageStream(
    sessionId: string,
    content: string,
    callbacks: {
      onThinking?: (status: string, message: string) => void;
      onSql?: (sql: string) => void;
      onResult?: (columns: string[], rows: (string | number | null)[][]) => void;
      onDone?: () => void;
      onError?: (error: string) => void;
    }
  ): EventSource {
    const url = `${API_BASE}/sessions/${sessionId}/messages/stream`;

    // 创建 POST 请求的 EventSource
    const eventSource = new EventSource(url, {
      // Note: 标准EventSource不支持POST，这里需要使用fetch API实现
    } as EventSourceInit);

    // 实际项目中应使用 fetch + ReadableStream 实现 SSE
    // 这里是简化版本，后续可优化
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // 事件类型已解析，后续处理
            continue;
          }
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());

              // 根据事件类型调用不同回调
              if (data.status && data.message) {
                callbacks.onThinking?.(data.status, data.message);
              }
              if (data.sql) {
                callbacks.onSql?.(data.sql);
              }
              if (data.columns && data.rows) {
                callbacks.onResult?.(data.columns, data.rows);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      callbacks.onDone?.();
    }).catch((error) => {
      callbacks.onError?.(error.message || '未知错误');
    });

    return eventSource;
  }
}

export const apiService = new ApiService();
export default apiService;