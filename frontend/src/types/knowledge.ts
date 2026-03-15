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

export type KnowledgeCategory = 'raw' | 'curated'
export type KnowledgeSubCategory = 'indicators' | 'rules' | 'datasets' | 'glossary' | null