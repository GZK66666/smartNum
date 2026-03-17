import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest, User, AgentStepEvent } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

class ApiError extends Error {
  code: number
  status: number
  constructor(code: number, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token')

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    const error = data.detail || data
    throw new ApiError(
      error.code || response.status,
      error.message || '请求失败',
      response.status
    )
  }

  return data
}

// Auth API
export const authApi = {
  login: async (body: LoginRequest): Promise<AuthResponse> => {
    // 后端直接返回 AuthResponse，不包裹在 ApiResponse 中
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  register: async (body: RegisterRequest): Promise<AuthResponse> => {
    // 后端直接返回 AuthResponse，不包裹在 ApiResponse 中
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  getMe: async (): Promise<User> => {
    // 后端直接返回 User，不包裹在 ApiResponse 中
    return request<User>('/api/auth/me')
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    })
  },
}

// DataSource API
export const datasourceApi = {
  list: async () => {
    const res = await request<ApiResponse<{ id: string; name: string; type: string; host: string; port: number; database: string; status: string; created_at: string }[]>>('/api/datasources')
    return res.data || []
  },

  create: async (body: {
    name: string
    type: string
    host: string
    port: number
    database: string
    username: string
    password: string
    schema_name?: string
  }) => {
    const res = await request<ApiResponse<{ id: string; name: string; type: string }>>('/api/datasources', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return res.data!
  },

  delete: async (id: string) => {
    const res = await request<ApiResponse<{ deleted_sessions: number }>>(`/api/datasources/${id}`, { method: 'DELETE' })
    return res.data!
  },

  test: async (body: {
    type: string
    host: string
    port: number
    database: string
    username: string
    password: string
    schema_name?: string
  }) => {
    const res = await request<ApiResponse<{ success: boolean; message: string }>>('/api/datasources/test', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return res.data!
  },

  getSchema: async (id: string) => {
    const res = await request<ApiResponse<{ tables: { name: string; columns: { name: string; type: string }[] }[] }>>(`/api/datasources/${id}/schema`)
    return res.data!
  },

  // File upload
  uploadFile: async (name: string, file: File): Promise<{
    id: string
    name: string
    type: string
    status: string
    tables: { name: string; columns: { name: string; type: string }[]; row_count: number }[]
    preview: { columns: string[]; data: unknown[][]; total_rows: number }
    created_at: string
  }> => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('name', name)
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/api/datasources/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data.detail || data
      throw new ApiError(
        error.code || response.status,
        error.message || '上传失败',
        response.status
      )
    }

    return data.data
  },

  previewFile: async (file: File): Promise<{
    filename: string
    columns: string[]
    data: unknown[][]
    total_rows: number
  }> => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/api/datasources/upload/preview`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data.detail || data
      throw new ApiError(
        error.code || response.status,
        error.message || '预览失败',
        response.status
      )
    }

    return data.data
  },

  // 查询指南相关
  getQueryGuide: async (datasourceId: string): Promise<{
    files: Array<{
      filename: string
      size: number
      updated_at: string
    }>
    notes: string
  }> => {
    const token = localStorage.getItem('token')
    const response = await fetch(`${API_BASE}/api/datasources/${datasourceId}/query-guide`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.detail?.code || response.status,
        data.detail?.message || '获取查询指南失败',
        response.status
      )
    }

    return data.data
  },

  updateQueryGuideNotes: async (datasourceId: string, notes: string): Promise<void> => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('notes', notes)

    const response = await fetch(`${API_BASE}/api/datasources/${datasourceId}/query-guide`, {
      method: 'PUT',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.detail?.code || response.status,
        data.detail?.message || '更新查询指南失败',
        response.status
      )
    }
  },

  uploadQueryGuideFile: async (datasourceId: string, file: File): Promise<{
    filename: string
    size: number
  }> => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/api/datasources/${datasourceId}/query-guide/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.detail?.code || response.status,
        data.detail?.message || '上传文件失败',
        response.status
      )
    }

    return data.data
  },

  deleteQueryGuideFile: async (datasourceId: string, filename: string): Promise<void> => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${API_BASE}/api/datasources/${datasourceId}/query-guide/files/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.detail?.code || response.status,
        data.detail?.message || '删除文件失败',
        response.status
      )
    }
  },
}

// Session API
interface SessionListResponse {
  code: number
  data: {
    id: string
    datasource_id: string
    datasource_name: string
    title: string | null
    message_count: number
    created_at: string
    last_active_at: string
  }[]
  next_cursor?: string
  has_more?: boolean
  total?: number
}

export const sessionApi = {
  list: async (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    const res = await request<SessionListResponse>(`/api/sessions?${params}`)
    return { data: res.data || [], nextCursor: res.next_cursor, hasMore: res.has_more, total: res.total || 0 }
  },

  create: async (datasourceId: string) => {
    const res = await request<ApiResponse<{
      id: string
      session_id: string
      datasource_id: string
      datasource_name: string
      title: string | null
    }>>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ datasource_id: datasourceId }),
    })
    return res.data!
  },

  delete: async (id: string) => {
    await request(`/api/sessions/${id}`, { method: 'DELETE' })
  },

  getMessages: async (sessionId: string, limit = 50) => {
    const res = await request<ApiResponse<{
      session_id: string
      messages: {
        id: string
        role: string
        blocks: { type: string; content: string }[]
        sql?: string
        result?: { columns: string[]; rows: unknown[][]; total: number; truncated: boolean }
        created_at: string
      }[]
    }>>(`/api/sessions/${sessionId}/messages?limit=${limit}`)
    return res.data?.messages || []
  },

  sendMessage: async (sessionId: string, content: string) => {
    const res = await request<ApiResponse<{
      message_id: string
      role: string
      content: string
      sql?: string
    }>>(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    return res.data!
  },
}

// SSE Stream
export function createMessageStream(
  sessionId: string,
  content: string,
  onMessage: (event: { type: string; content?: string; sql?: string; result?: unknown; error?: string }) => void,
  onError: (error: Error) => void,
  onComplete: () => void
) {
  const token = localStorage.getItem('token')

  fetch(`${API_BASE}/api/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  }).then(async (response) => {
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.detail?.message || '请求失败')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            onMessage(data)
            if (data.type === 'done' || data.type === 'error') {
              onComplete()
              return
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    onComplete()
  }).catch(onError)
}

// Enhanced SSE Stream for Agent Steps
export type AgentStreamCallback = {
  onContent: (content: string) => void
  onStep: (step: AgentStepEvent) => void
  onError: (error: string) => void
  onComplete: () => void
}

// Filter thinking tags from content - supports multiple formats
export function filterThinkingContent(content: string): string {
  return content
    // XML-style tags: <thinking>...</thinking>, <think>...</think>
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    // Markdown-style: **(thinking)**...**/thinking**
    .replace(/\*\*\(thinking\)\*\*[\s\S]*?\*\*\/thinking\*\*/gi, '')
    .replace(/\*\*thinking\*\*[\s\S]*?\*\*\/thinking\*\*/gi, '')
    // Chinese variants
    .replace(/\*\*思考中\*\*[\s\S]*?\*\*\/思考中\*\*/gi, '')
    // Plain text thinking blocks
    .replace(/^\s*thinking:\s*[\s\S]*?(?=\n\n|\n[A-Z]|$)/gim, '')
    // Anthropic Claude extended thinking format
    .replace(/\u003cthinking\u003e[\s\S]*?\u003c\/thinking\u003e/gi, '')
    .trim()
}

export function createAgentMessageStream(
  sessionId: string,
  content: string,
  callbacks: AgentStreamCallback
) {
  const token = localStorage.getItem('token')

  fetch(`${API_BASE}/api/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  }).then(async (response) => {
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.detail?.message || '请求失败')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6)) as AgentStepEvent

            // Filter out thinking events
            if (event.type === 'thinking') {
              console.log('[SSE] Filtered thinking event:', event)
              continue
            }

            // Handle different event types
            if (event.type === 'message' && event.content) {
              // Filter thinking tags from content
              const filteredContent = filterThinkingContent(event.content)
              if (filteredContent) {
                callbacks.onContent(filteredContent)
              }
            } else if (event.type === 'done') {
              callbacks.onComplete()
              return
            } else if (event.type === 'error') {
              callbacks.onError(event.error || '未知错误')
              callbacks.onComplete()
              return
            } else {
              // Pass other step events (tool_call, tool_result, sql_generation, sql_execution)
              callbacks.onStep(event)
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    callbacks.onComplete()
  }).catch((err) => {
    callbacks.onError(err.message || '请求失败')
    callbacks.onComplete()
  })
}

export { ApiError }