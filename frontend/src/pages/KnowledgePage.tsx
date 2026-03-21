import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  File,
  FileText,
  Trash2,
  Eye,
  X,
  Loader2,
  FolderOpen,
  Search,
  ChevronRight,
  Clock,
  RefreshCw,
  Play,
} from 'lucide-react'
import { ragflowApi } from '../services/api'
import type { RagflowDocument } from '../types'

export default function KnowledgePage() {
  const queryClient = useQueryClient()
  const [previewFile, setPreviewFile] = useState<RagflowDocument | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

  // 获取 RAGFLOW 文件列表 - 每 5 秒轮询一次，更新解析进度
  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['ragflow-files'],
    queryFn: ragflowApi.listFiles,
    refetchInterval: 5000,
  })

  // 上传处理
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const allowedTypes = ['.txt', '.md', '.docx', '.pdf']

    for (const file of fileArray) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.includes(ext)) {
        alert(`不支持的文件格式：${ext}`)
        continue
      }

      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

      try {
        await ragflowApi.uploadFile(file)
        queryClient.invalidateQueries({ queryKey: ['ragflow-files'] })
      } catch (error) {
        console.error('Upload failed:', error)
        alert(`上传失败：${file.name}`)
      } finally {
        setUploadProgress(prev => {
          const next = { ...prev }
          delete next[file.name]
          return next
        })
      }
    }
  }, [queryClient])

  // 删除处理
  const deleteMutation = useMutation({
    mutationFn: ragflowApi.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ragflow-files'] })
      setDeleteId(null)
    },
  })

  // 解析文件
  const parseMutation = useMutation({
    mutationFn: (docIds: string[]) => ragflowApi.parseFiles(docIds),
    onSuccess: () => {
      refetch()
    },
  })

  // 处理拖拽事件
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

  // 格式化函数
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待解析'
      case 'parsing':
        return '解析中'
      case 'ready':
        return '已完成'
      case 'failed':
        return '解析失败'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400'
      case 'parsing':
        return 'text-yellow-400'
      case 'ready':
        return 'text-green-400'
      case 'failed':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-400/20 text-gray-400'
      case 'parsing':
        return 'bg-yellow-400/20 text-yellow-400'
      case 'ready':
        return 'bg-green-400/20 text-green-400'
      case 'failed':
        return 'bg-red-400/20 text-red-400'
      default:
        return 'bg-white/10 text-gray-400'
    }
  }

  // 获取文件类型图标
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <File className="w-5 h-5 text-red-400" />
      case 'docx':
      case 'doc':
        return <FileText className="w-5 h-5 text-blue-400" />
      case 'md':
      case 'markdown':
        return <FileText className="w-5 h-5 text-purple-400" />
      case 'txt':
        return <FileText className="w-5 h-5 text-gray-400" />
      default:
        return <FileText className="w-5 h-5 text-gray-400" />
    }
  }

  // 过滤文件
  const filteredFiles = files.filter((file: RagflowDocument) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
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
            RAGFLOW 知识库管理
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400"
          >
            管理 RAGFLOW 知识库文档，上传文件并查看解析进度
          </motion.p>
        </div>

        {/* Refresh Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => refetch()}
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-gray-400 hover:text-white transition-all"
          title="刷新列表"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

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
            支持格式：TXT, Markdown, Word, PDF (最大 10MB)
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

      {/* 统计信息 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <div className="text-gray-400 text-sm mb-1">总文件数</div>
          <div className="text-2xl font-bold text-white">{files.length}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-4"
        >
          <div className="text-gray-400 text-sm mb-1">等待解析</div>
          <div className="text-2xl font-bold text-gray-400">
            {files.filter(f => f.status === 'pending').length}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <div className="text-gray-400 text-sm mb-1">解析中</div>
          <div className="text-2xl font-bold text-yellow-400">
            {files.filter(f => f.status === 'parsing').length}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="glass-card p-4"
        >
          <div className="text-gray-400 text-sm mb-1">已完成</div>
          <div className="text-2xl font-bold text-green-400">
            {files.filter(f => f.status === 'ready').length}
          </div>
        </motion.div>
      </div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex items-center gap-4 mb-6"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="搜索文件..."
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
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredFiles.map((file: RagflowDocument, index: number) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card-hover p-5 group relative"
              >
                {/* Actions */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="p-2 text-gray-500 hover:text-accent-primary hover:bg-accent-primary/10 rounded-lg transition-colors"
                    title="预览"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {file.status === 'pending' && (
                    <button
                      onClick={() => parseMutation.mutate([file.id])}
                      className="p-2 text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                      title="开始解析"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteId(file.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Icon & Info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-medium text-white truncate mb-1">
                      {file.name}
                    </h4>
                    <p className="text-gray-400 text-xs">
                      {formatSize(file.size)} · {file.type.toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* 状态和进度 */}
                {file.status === 'pending' && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs bg-gray-400/20 text-gray-400 rounded">
                        等待解析
                      </span>
                      <button
                        onClick={() => parseMutation.mutate([file.id])}
                        className="ml-auto px-3 py-1 text-xs bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        开始解析
                      </button>
                    </div>
                  </div>
                )}

                {file.status === 'parsing' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-yellow-400">解析中</span>
                      <span className="text-gray-400">{(file.progress * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-yellow-400 h-full rounded-full transition-all"
                        style={{ width: `${file.progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {file.status === 'ready' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="px-2 py-1 text-xs bg-green-400/20 text-green-400 rounded">
                      已完成
                    </span>
                    <span className="text-xs text-gray-500">
                      {file.chunk_count} 个片段
                    </span>
                  </div>
                )}

                {file.status === 'failed' && (
                  <div className="mt-3">
                    <button
                      onClick={() => parseMutation.mutate([file.id])}
                      className="px-3 py-1 text-xs bg-red-400/20 text-red-400 rounded hover:bg-red-400/30 transition-colors"
                    >
                      重新解析
                    </button>
                  </div>
                )}

                {/* 创建时间 */}
                <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDate(file.created_at)}</span>
                </div>

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
            上传文件到 RAGFLOW 知识库，开始构建您的知识体系
          </p>
        </motion.div>
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
              className="glass-card w-full max-w-md overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    {getFileIcon(previewFile.type)}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-white">
                      {previewFile.name}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {formatSize(previewFile.size)}
                    </p>
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
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">状态</span>
                    <span className={`px-2 py-1 text-xs rounded ${getStatusBg(previewFile.status)}`}>
                      {getStatusText(previewFile.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">解析进度</span>
                    <span className="text-white text-sm">{(previewFile.progress * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">片段数</span>
                    <span className="text-white text-sm">{previewFile.chunk_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">上传时间</span>
                    <span className="text-white text-sm">{formatDate(previewFile.created_at)}</span>
                  </div>
                </div>

                {previewFile.status === 'pending' && (
                  <button
                    onClick={() => {
                      parseMutation.mutate([previewFile.id])
                      setPreviewFile(null)
                    }}
                    className="w-full mt-4 px-4 py-2 bg-accent-primary/20 border border-accent-primary/30 text-accent-primary font-medium rounded-xl hover:bg-accent-primary/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    开始解析
                  </button>
                )}

                {previewFile.status === 'failed' && (
                  <button
                    onClick={() => {
                      parseMutation.mutate([previewFile.id])
                      setPreviewFile(null)
                    }}
                    className="w-full mt-4 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 font-medium rounded-xl hover:bg-red-500/30 transition-colors"
                  >
                    重新解析
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <button
                  onClick={() => setPreviewFile(null)}
                  className="w-full btn-secondary"
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
                确定要删除「{files.find((f: RagflowDocument) => f.id === deleteId)?.name}」吗？此操作不可撤销。
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
