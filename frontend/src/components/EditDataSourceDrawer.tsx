import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Upload,
  FileText,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import { datasourceApi } from '../services/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  datasource: {
    id: string
    name: string
    type: string
    host?: string
    port?: number
    database_name?: string
    db_username?: string
    schema_name?: string
  } | null
  onUpdate?: () => void
}

export default function EditDataSourceDrawer({ isOpen, onClose, datasource, onUpdate }: Props) {
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<Array<{
    filename: string
    size: number
    updated_at: string
  }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载查询指南内容
  useEffect(() => {
    if (isOpen && datasource) {
      loadQueryGuide()
    }
  }, [isOpen, datasource])

  const loadQueryGuide = async () => {
    if (!datasource) return

    setIsLoading(true)
    try {
      const data = await datasourceApi.getQueryGuide(datasource.id)
      setNotes(data.notes)
      setFiles(data.files)
    } catch (err) {
      console.error('加载查询指南失败:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!datasource) return

    setIsSaving(true)
    try {
      await datasourceApi.updateQueryGuideNotes(datasource.id, notes)
      onUpdate?.()
      onClose()
    } catch (err) {
      console.error('保存失败:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !datasource) return

    try {
      const result = await datasourceApi.uploadQueryGuideFile(datasource.id, file)
      setFiles(prev => [...prev, {
        filename: result.filename,
        size: result.size,
        updated_at: new Date().toISOString(),
      }])
    } catch (err) {
      console.error('上传失败:', err)
    }

    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteFile = async (filename: string) => {
    if (!datasource) return

    try {
      await datasourceApi.deleteQueryGuideFile(datasource.id, filename)
      setFiles(prev => prev.filter(f => f.filename !== filename))
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  if (!datasource) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* 侧边抽屉 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-dark-800 border-l border-white/10 z-50 overflow-y-auto"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">编辑数据源</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 基本信息 */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-300 mb-3">基本信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">名称</span>
                  <span className="text-white">{datasource.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">类型</span>
                  <span className="text-white">{datasource.type.toUpperCase()}</span>
                </div>
                {datasource.host && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">主机</span>
                    <span className="text-white">{datasource.host}:{datasource.port}</span>
                  </div>
                )}
                {datasource.database_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">数据库</span>
                    <span className="text-white">{datasource.database_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 查询指南 */}
            <div className="p-4">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-300 mb-3"
              >
                <span>查询指南</span>
                {showGuide ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showGuide && (
                <div className="space-y-4">
                  {/* 提示 */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">查询指南帮助智能体更准确理解数据</p>
                        <p className="text-blue-200/70">
                          内容越规范、越详细，查询效果越好。建议包含：表/字段说明、常用SQL参考、业务规则、注意事项等。
                        </p>
                        <p className="text-yellow-300/80 mt-1">⚠️ 文档越多，查询响应可能稍慢</p>
                      </div>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <>
                      {/* 已上传文档 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">📄 已上传文档</span>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-accent-primary hover:text-accent-secondary"
                          >
                            + 上传文档
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.md,.docx,.pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </div>

                        {files.length > 0 ? (
                          <div className="space-y-1">
                            {files.map(file => (
                              <div
                                key={file.filename}
                                className="flex items-center justify-between bg-dark-700 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-white truncate">{file.filename}</span>
                                  <span className="text-xs text-gray-500">
                                    {(file.size / 1024).toFixed(1)}KB
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteFile(file.filename)}
                                  className="text-gray-400 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 text-center py-2">暂无上传文档</p>
                        )}
                      </div>

                      {/* 备注说明 */}
                      <div>
                        <span className="text-sm text-gray-400 mb-2 block">📝 备注说明</span>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={"# 表说明\n\n## users 表\n用户基础信息表...\n\n## 常用查询参考\n- 查询活跃用户: SELECT * FROM users WHERE status = 1"}
                          className="w-full h-64 bg-dark-700 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-accent-primary"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="sticky bottom-0 left-0 right-0 p-4 bg-dark-800 border-t border-white/10">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}