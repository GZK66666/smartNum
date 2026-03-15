import { ApiError } from './api'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export interface KnowledgeFile {
  id: string
  datasource_id: string | null
  filename: string
  file_type: string
  category: 'raw' | 'curated'
  sub_category: string | null
  title: string | null
  description: string | null
  tags: string[] | null
  auto_summary: string | null
  mentioned_tables: string[] | null
  file_size: number
  use_count: number
  created_at: string
  updated_at?: string
}

export interface KnowledgeSearchResult {
  id: string
  filename: string
  title: string | null
  category: string
  sub_category: string | null
  context: string
  use_count: number
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const knowledgeApi = {
  /**
   * List knowledge files
   */
  async list(datasourceId?: string): Promise<KnowledgeFile[]> {
    const params = new URLSearchParams()
    if (datasourceId) params.append('datasource_id', datasourceId)

    const response = await fetch(
      `${API_BASE}/api/knowledge/files?${params.toString()}`,
      {
        headers: getAuthHeaders(),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '获取知识文件列表失败', response.status)
    }

    const data = await response.json()
    return data.data
  },

  /**
   * Upload a knowledge file
   */
  async upload(
    file: File,
    datasourceId?: string,
    category: 'raw' | 'curated' = 'raw',
    subCategory?: string,
    title?: string,
    description?: string,
    tags?: string[]
  ): Promise<KnowledgeFile> {
    const formData = new FormData()
    formData.append('file', file)

    const params = new URLSearchParams()
    if (datasourceId) params.append('datasource_id', datasourceId)
    params.append('category', category)
    if (subCategory) params.append('sub_category', subCategory)
    if (title) params.append('title', title)
    if (description) params.append('description', description)
    if (tags && tags.length > 0) params.append('tags', tags.join(','))

    const token = localStorage.getItem('token')
    const response = await fetch(
      `${API_BASE}/api/knowledge/files?${params.toString()}`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '上传失败', response.status)
    }

    const data = await response.json()
    return data.data
  },

  /**
   * Get a knowledge file by ID
   */
  async get(fileId: string): Promise<KnowledgeFile> {
    const response = await fetch(
      `${API_BASE}/api/knowledge/files/${fileId}`,
      {
        headers: getAuthHeaders(),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '获取文件信息失败', response.status)
    }

    const data = await response.json()
    return data.data
  },

  /**
   * Get knowledge file content
   */
  async getContent(fileId: string): Promise<string> {
    const response = await fetch(
      `${API_BASE}/api/knowledge/files/${fileId}/content`,
      {
        headers: getAuthHeaders(),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '获取文件内容失败', response.status)
    }

    return response.text()
  },

  /**
   * Delete a knowledge file
   */
  async delete(fileId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/api/knowledge/files/${fileId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '删除失败', response.status)
    }
  },

  /**
   * Search knowledge files
   */
  async search(
    query: string,
    datasourceId?: string,
    limit: number = 10
  ): Promise<KnowledgeSearchResult[]> {
    const response = await fetch(
      `${API_BASE}/api/knowledge/search`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ query, limit }),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '搜索失败', response.status)
    }

    const data = await response.json()
    return data.data
  },

  /**
   * Explore knowledge base with shell commands
   */
  async explore(command: string, datasourceId?: string): Promise<string> {
    const params = new URLSearchParams()
    if (datasourceId) params.append('datasource_id', datasourceId)

    const response = await fetch(
      `${API_BASE}/api/knowledge/explore?${params.toString()}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ command }),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '探索失败', response.status)
    }

    const data = await response.json()
    return data.data.output
  },

  /**
   * Get knowledge base structure
   */
  async getStructure(datasourceId?: string): Promise<string> {
    const params = new URLSearchParams()
    if (datasourceId) params.append('datasource_id', datasourceId)

    const response = await fetch(
      `${API_BASE}/api/knowledge/structure?${params.toString()}`,
      {
        headers: getAuthHeaders(),
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(data.detail?.message || '获取结构失败', response.status)
    }

    const data = await response.json()
    return data.data.structure
  },
}