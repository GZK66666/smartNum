import { create } from 'zustand';
import type { DataSource, Session, Message, SchemaInfo, ThinkingEvent } from '@/types';
import { apiService } from '@/services/api';

interface AppState {
  // 数据源状态
  dataSources: DataSource[];
  currentDataSource: DataSource | null;
  schemaInfo: SchemaInfo | null;
  isLoadingDataSources: boolean;

  // 会话状态
  currentSession: Session | null;
  messages: Message[];
  isLoadingMessages: boolean;

  // UI 状态
  isTyping: boolean;
  thinkingMessage: string;
  thinkingEvents: ThinkingEvent[];

  // 数据源操作
  fetchDataSources: () => Promise<void>;
  setCurrentDataSource: (ds: DataSource | null) => void;
  addDataSource: (config: Parameters<typeof apiService.addDataSource>[0]) => Promise<DataSource>;
  deleteDataSource: (id: string) => Promise<void>;
  testConnection: (config: Parameters<typeof apiService.testDataSource>[0]) => Promise<{ success: boolean; message: string }>;
  fetchSchema: (id: string) => Promise<void>;

  // 会话操作
  createSession: (datasourceId: string) => Promise<Session>;
  setCurrentSession: (session: Session | null) => void;
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;

  // UI 操作
  setTyping: (isTyping: boolean, message?: string) => void;
  addThinkingEvent: (event: ThinkingEvent) => void;
  clearThinkingEvents: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  dataSources: [],
  currentDataSource: null,
  schemaInfo: null,
  isLoadingDataSources: false,

  currentSession: null,
  messages: [],
  isLoadingMessages: false,

  isTyping: false,
  thinkingMessage: '',
  thinkingEvents: [],

  // 数据源操作
  fetchDataSources: async () => {
    set({ isLoadingDataSources: true });
    try {
      const dataSources = await apiService.getDataSources();
      set({ dataSources, isLoadingDataSources: false });
    } catch (error) {
      set({ isLoadingDataSources: false });
      throw error;
    }
  },

  setCurrentDataSource: (ds) => {
    set({ currentDataSource: ds, schemaInfo: null });
    if (ds) {
      get().fetchSchema(ds.id);
    }
  },

  addDataSource: async (config) => {
    const dataSource = await apiService.addDataSource(config);
    set((state) => ({
      dataSources: [...state.dataSources, dataSource],
    }));
    return dataSource;
  },

  deleteDataSource: async (id) => {
    await apiService.deleteDataSource(id);
    set((state) => ({
      dataSources: state.dataSources.filter((ds) => ds.id !== id),
      currentDataSource: state.currentDataSource?.id === id ? null : state.currentDataSource,
    }));
  },

  testConnection: async (config) => {
    return await apiService.testDataSource(config);
  },

  fetchSchema: async (id) => {
    try {
      const schemaInfo = await apiService.getDataSourceSchema(id);
      set({ schemaInfo });
    } catch (error) {
      console.error('Failed to fetch schema:', error);
      set({ schemaInfo: null });
    }
  },

  // 会话操作
  createSession: async (datasourceId) => {
    const session = await apiService.createSession(datasourceId);
    set({ currentSession: session, messages: [] });
    return session;
  },

  setCurrentSession: (session) => {
    set({ currentSession: session });
  },

  fetchMessages: async (sessionId) => {
    set({ isLoadingMessages: true });
    try {
      const messages = await apiService.getSessionMessages(sessionId);
      set({ messages, isLoadingMessages: false });
    } catch (error) {
      set({ isLoadingMessages: false });
      throw error;
    }
  },

  sendMessage: async (content) => {
    const { currentSession, messages } = get();
    if (!currentSession) return;

    // 添加用户消息（使用 blocks 格式）
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      blocks: [{ type: 'text', content }],
      created_at: new Date().toISOString(),
    };

    set({
      messages: [...messages, userMessage],
      isTyping: true,
      thinkingMessage: '正在分析您的问题...',
      thinkingEvents: [],
    });

    try {
      // 使用流式 API
      const response = await apiService.sendMessageStream(
        currentSession.session_id,
        content,
        {
          onEvent: (event) => {
            get().addThinkingEvent(event);
          },
          onThinking: (message) => {
            set({ thinkingMessage: message });
          },
          onError: (error) => {
            console.error('Stream error:', error);
          },
        }
      );

      // 更新消息列表
      set((state) => ({
        messages: [...state.messages.filter(m => m.id !== userMessage.id), userMessage, response],
        isTyping: false,
        thinkingMessage: '',
        thinkingEvents: [],
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '发送消息失败';
      set((state) => ({
        messages: [
          ...state.messages.filter(m => m.id !== userMessage.id),
          userMessage,
          {
            id: `error-${Date.now()}`,
            role: 'assistant' as const,
            blocks: [],
            error: errorMessage,
            created_at: new Date().toISOString(),
          },
        ],
        isTyping: false,
        thinkingMessage: '',
        thinkingEvents: [],
      }));
    }
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  // UI 操作
  setTyping: (isTyping, message = '') => {
    set({ isTyping, thinkingMessage: message });
  },

  addThinkingEvent: (event: ThinkingEvent) => {
    set((state) => ({
      thinkingEvents: [...state.thinkingEvents, event],
    }));
  },

  clearThinkingEvents: () => {
    set({ thinkingEvents: [] });
  },
}));