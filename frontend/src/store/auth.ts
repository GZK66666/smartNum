import { create } from 'zustand';
import type { User, LoginRequest, RegisterRequest } from '@/types';
import { apiService } from '@/services/api';

const TOKEN_KEY = 'smartnum_access_token';
const USER_KEY = 'smartnum_user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // 认证操作
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true, // 初始加载状态为 true，等待 fetchUser 完成
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.login(credentials);
      const { access_token, user_id, username, email } = response;

      const user: User = { user_id, username, email, status: 1 };

      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      // 设置 API client 的 token
      apiService.setAuthToken(access_token);

      set({
        user,
        accessToken: access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.register(data);
      const { access_token, user_id, username, email } = response;

      const user: User = { user_id, username, email, status: 1 };

      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      apiService.setAuthToken(access_token);

      set({
        user,
        accessToken: access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '注册失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    apiService.setAuthToken(null);
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  fetchUser: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ isAuthenticated: false, user: null, isLoading: false });
      return;
    }

    // 设置 token 到 API client
    apiService.setAuthToken(token);

    try {
      const user = await apiService.getCurrentUser();
      set({ user, isAuthenticated: true, accessToken: token, isLoading: false });
    } catch (error) {
      // Token 过期或无效，清除
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
