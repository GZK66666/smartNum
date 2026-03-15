import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  File,
  Trash2,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Search,
  ChevronRight,
  Database,
  Clock,
  HardDrive,
  ChevronDown,
} from 'lucide-react'
import { knowledgeApi } from '../services/knowledgeApi'
import { datasourceApi } from '../services/api'
import type { KnowledgeFile } from '../types/knowledge'

export default function KnowledgePage() {
  const queryClient = useQueryClient()
  const [selectedDatasource, setSelectedDatasource] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch datasources for selector
  const { data: datasources = [] } = useQuery({
    queryKey: ['datasources'],
    queryFn: datasourceApi.list,
  })

  // Auto-select first datasource if none selected
  useEffect(() => {
    if (!selectedDatasource && datasources.length > 0) {
      setSelectedDatasource(datasources[0].id)
    }
  }, [datasources, selectedDatasource])

  // Fetch knowledge files
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['knowledge-files', selectedDatasource],
    queryFn: () => knowledgeApi.list(selectedDatasource || undefined),
    enabled: !!selectedDatasource,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: knowledgeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-files'] })
      setDeleteId(null)
    },
  })

  // Handle file upload
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const allowedTypes = ['.txt', '.md', '.docx', '.pdf']

    for (const file of fileArray) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.includes(ext)) {
        alert(`不支持的文件格式: ${ext}`)
        continue
      }

      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

      try {
        await knowledgeApi.upload(
          file,
          selectedDatasource || undefined,
          'raw',
          undefined,
          undefined,
          undefined,
          undefined
        )
        queryClient.invalidateQueries({ queryKey: ['knowledge-files'] })
      } catch (error) {
        console.error('Upload failed:', error)
        alert(`上传失败: ${file.name}`)
      } finally {
        setUploadProgress(prev => {
          const next = { ...prev }
          delete next[file.name]
          return next
        })
      }
    }
  }, [selectedDatasource, queryClient])

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }, [handleUpload])

  // Handle preview
  const handlePreview = async (file: KnowledgeFile) => {
    setPreviewFile(file)
    setPreviewContent('加载中...')
    try {
      const content = await knowledgeApi.getContent(file.id)
      setPreviewContent(content)
    } catch {
      setPreviewContent('无法加载文件内容')
    }
  }

  // Get file type icon
  const getFileIcon = (type: string) => {
    switch (type) {
      case '.pdf':
        return <File className="w-5 h-5 text-red-400" />
      case '.docx':
        return <FileText className="w-5 h-5 text-blue-400" />
      case '.md':
        return <FileText className="w-5 h-5 text-purple-400" />
      default:
        return <FileText className="w-5 h-5 text-gray-400" />
    }
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filter files by search
  const filteredFiles = files.filter((file: KnowledgeFile) =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-3xl font-bold text-white mb-2"
          >
            知识库管理
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400"
          >
            上传和管理业务知识文件，帮助 AI 更好地理解数据
          </motion.p>
        </div>

        {/* Datasource Selector */}
        <motion.div
          ref={selectRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          {/* Trigger Button */}
          <button
            onClick={() => setIsSelectOpen(!isSelectOpen)}
            disabled={datasources.length === 0}
            className="flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white text-sm transition-all duration-200 min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center">
              <Database className="w-4 h-4 text-accent-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium">
                {selectedDatasource
                  ? datasources.find((ds) => ds.id === selectedDatasource)?.name
                  : '选择数据源'}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isSelectOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isSelectOpen && datasources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 w-64 py-2 bg-dark-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 max-h-[300px] overflow-auto"
              >
                {/* Datasource Options */}
                {datasources.map((ds) => {
                  const isSelected = ds.id === selectedDatasource
                  return (
                    <button
                      key={ds.id}
                      onClick={() => {
                        setSelectedDatasource(ds.id)
                        setIsSelectOpen(false)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isSelected
                          ? 'bg-accent-primary/10 text-white'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-accent-primary/20' : 'bg-white/5'
                      }`}>
                        <Database className={`w-4 h-4 ${isSelected ? 'text-accent-primary' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`font-medium text-sm ${isSelected ? 'text-white' : ''}`}>
                          {ds.name}
                        </div>
                        <div className="text-xs text-gray-500">{ds.type.toUpperCase()} · {ds.database}</div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-accent-primary" />
                      )}
                    </button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* No Datasource State */}
      {datasources.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center"
        >
          <Database className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-white mb-2">
            暂无数据源
          </h3>
          <p className="text-gray-400 mb-6">
            请先创建数据源，再上传相关知识文件
          </p>
          <Link to="/datasources/new" className="btn-primary inline-flex">
            添加数据源
          </Link>
        </motion.div>
      ) : (
        <>
          {/* Upload Area */}
          <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative mb-8 p-8 border-2 border-dashed rounded-2xl transition-all duration-300
          ${isDragging
            ? 'border-accent-primary bg-accent-primary/10 scale-[1.02]'
            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
          }
        `}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".txt,.md,.docx,.pdf"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center">
          <div className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all
            ${isDragging ? 'bg-accent-primary/20 text-accent-primary' : 'bg-white/5 text-gray-400'}
          `}>
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="font-display text-lg font-semibold text-white mb-2">
            {isDragging ? '松开以上传文件' : '拖拽文件到此处上传'}
          </h3>

          <p className="text-gray-400 text-sm mb-4">
            支持格式: TXT, Markdown, Word, PDF (最大 10MB)
          </p>

          <label
            htmlFor="file-upload"
            className="cursor-pointer px-6 py-3 bg-accent-primary/20 border border-accent-primary/30 text-accent-primary font-display font-medium rounded-xl hover:bg-accent-primary/30 transition-colors"
          >
            选择文件
          </label>
        </div>

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-accent-primary animate-spin mx-auto mb-2" />
              <p className="text-white">上传中...</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-4 mb-6"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="搜索知识文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{filteredFiles.length} 个文件</span>
        </div>
      </motion.div>

      {/* Files Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      ) : filteredFiles.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredFiles.map((file: KnowledgeFile, index: number) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card-hover p-5 group relative cursor-pointer"
                onClick={() => handlePreview(file)}
              >
                {/* Actions */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePreview(file)
                    }}
                    className="p-2 text-gray-500 hover:text-accent-primary hover:bg-accent-primary/10 rounded-lg transition-colors"
                    title="预览"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(file.id)
                    }}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Icon & Info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    {getFileIcon(file.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-medium text-white truncate mb-1">
                      {file.title || file.filename}
                    </h4>
                    <p className="text-gray-400 text-xs truncate">{file.filename}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>{formatSize(file.file_size)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(file.created_at)}</span>
                  </div>
                </div>

                {/* Category Badge */}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`
                    px-2 py-0.5 text-xs font-medium rounded-md
                    ${file.category === 'curated'
                      ? 'bg-accent-primary/20 text-accent-primary'
                      : 'bg-white/10 text-gray-400'
                    }
                  `}>
                    {file.category === 'curated' ? '精选' : '原始'}
                  </span>
                  {file.sub_category && (
                    <span className="px-2 py-0.5 text-xs bg-white/5 text-gray-500 rounded-md">
                      {file.sub_category}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {file.tags && file.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {file.tags.slice(0, 3).map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs bg-white/5 text-gray-500 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Preview hint */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center"
        >
          <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-white mb-2">
            知识库为空
          </h3>
          <p className="text-gray-400 mb-6">
            上传知识文件，帮助 AI 更好地理解您的业务数据
          </p>
        </motion.div>
      )}
        </>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  {getFileIcon(previewFile.file_type)}
                  <div>
                    <h3 className="font-display font-semibold text-white">
                      {previewFile.title || previewFile.filename}
                    </h3>
                    <p className="text-gray-400 text-sm">{previewFile.filename}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {previewContent}
                </pre>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/5">
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{formatSize(previewFile.file_size)}</span>
                  <span>{previewFile.use_count} 次使用</span>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="btn-secondary"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-xl font-semibold text-white mb-4">
                确认删除文件
              </h3>
              <p className="text-gray-400 mb-6">
                确定要删除「{files.find((f: KnowledgeFile) => f.id === deleteId)?.filename}」吗？此操作不可撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteId)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-400 font-display font-medium rounded-xl hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}