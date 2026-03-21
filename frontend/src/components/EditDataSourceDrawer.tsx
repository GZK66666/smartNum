import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Loader2,
  CheckCircle2,
  XCircle,
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
    database?: string       // DataSourcePage 传递的字段名
    username?: string       // DataSourcePage 传递的字段名
    database_name?: string  // API 返回的字段名（兼容）
    db_username?: string    // API 返回的字段名（兼容）
    schema_name?: string
  } | null
  onUpdate?: () => void
}

export default function EditDataSourceDrawer({ isOpen, onClose, datasource, onUpdate }: Props) {
  const [isSaving, setIsSaving] = useState(false)

  // 基本信息表单状态
  const [basicForm, setBasicForm] = useState({
    name: '',
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
    schema_name: '',
  })
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [hasPasswordFocus, setHasPasswordFocus] = useState(false)

  // 初始化基本信息表单
  const initBasicForm = () => {
    if (!datasource) return
    console.log('[EditDataSourceDrawer] 初始化表单，datasource:', datasource)
    setBasicForm({
      name: datasource.name || '',
      host: datasource.host || '',
      port: datasource.port || 3306,
      // 兼容两种字段名：优先使用 database/username，如果没有则使用 database_name/db_username
      database: datasource.database || datasource.database_name || '',
      username: datasource.username || datasource.db_username || '',
      password: '••••••', // 密码占位符
      schema_name: datasource.schema_name || '',
    })
    setHasPasswordFocus(false)
  }

  // 加载基本信息
  useEffect(() => {
    if (isOpen && datasource) {
      initBasicForm()
    }
  }, [isOpen, datasource])

  const updateBasicForm = (updates: Partial<typeof basicForm>) => {
    setBasicForm((prev) => ({ ...prev, ...updates }))
  }

  const handleTestConnection = async () => {
    if (!datasource) return

    setIsTesting(true)
    setTestError('')
    setTestResult('idle')

    try {
      // 如果密码是占位符，使用后端存储的密码（不发送 password 字段）
      const testPayload: Record<string, any> = {
        type: datasource.type,
        host: basicForm.host,
        port: basicForm.port,
        database: basicForm.database,
        username: basicForm.username,
        schema_name: basicForm.schema_name || undefined,
      }

      // 只有当密码不是占位符且不为空时才发送
      if (basicForm.password !== '••••••' && basicForm.password !== '') {
        testPayload.password = basicForm.password
      }

      const result = await datasourceApi.testById(datasource.id, testPayload)
      setTestResult(result.success ? 'success' : 'error')
      if (!result.success) {
        setTestError(result.message || '连接失败')
      }
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : '连接失败')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!datasource) return

    setIsSaving(true)
    try {
      console.log('[EditDataSourceDrawer] 开始保存，basicForm:', basicForm)

      // 保存基本信息
      if (datasource.type !== 'file') {
        // 数据库类型：保存所有连接信息
        // 只发送修改过的字段，未修改的字段不发送（避免空字符串覆盖原有值）
        const updatePayload: Record<string, any> = {
          name: basicForm.name,
        }

        // 获取原始值（兼容两种字段名）
        const originalDatabase = datasource.database || datasource.database_name || ''
        const originalUsername = datasource.username || datasource.db_username || ''

        // 只有当值改变时才发送连接信息
        if (basicForm.host !== datasource.host) {
          updatePayload.host = basicForm.host
        }
        if (basicForm.port !== datasource.port) {
          updatePayload.port = basicForm.port
        }
        if (basicForm.database !== originalDatabase) {
          updatePayload.database = basicForm.database
        }
        if (basicForm.username !== originalUsername) {
          updatePayload.username = basicForm.username
        }
        // 密码特殊处理：只有当不是占位符且不为空时才发送
        if (basicForm.password !== '••••••' && basicForm.password !== '') {
          updatePayload.password = basicForm.password
        }
        if (basicForm.schema_name !== (datasource.schema_name || '')) {
          updatePayload.schema_name = basicForm.schema_name || undefined
        }

        console.log('[EditDataSourceDrawer] 更新数据库数据源，payload:', updatePayload)
        await datasourceApi.update(datasource.id, updatePayload)
      } else {
        // 文件类型：只保存名称
        console.log('[EditDataSourceDrawer] 更新文件数据源，name:', basicForm.name)
        await datasourceApi.update(datasource.id, {
          name: basicForm.name,
        })
      }

      console.log('[EditDataSourceDrawer] 保存完成')

      onUpdate?.()
      onClose()
    } catch (err) {
      console.error('[EditDataSourceDrawer] 保存失败:', err)
      alert(`保存失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (!datasource) return null

  return (
    <>
      {/* 背景遮罩 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={(e) => {
              e.preventDefault()
              onClose()
            }}
            style={{ pointerEvents: 'auto' }}
            className="fixed inset-0 bg-black/50 z-[60]"
          />
        )}
      </AnimatePresence>

      {/* 侧边抽屉 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full w-[480px] bg-dark-800 border-l border-white/10 z-[61] overflow-y-auto"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">编辑数据源</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 基本信息 */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">基本信息</h3>
                <span className="text-xs text-gray-500">{datasource.type.toUpperCase()}</span>
              </div>

              {datasource.type === 'file' ? (
                // 文件类型只允许编辑名称
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">名称</label>
                    <input
                      type="text"
                      value={basicForm.name}
                      onChange={(e) => updateBasicForm({ name: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-3 text-xs text-gray-400">
                    <p>文件类型数据源不支持修改连接信息</p>
                    <p className="mt-1">如需更改文件，请删除后重新上传</p>
                  </div>
                </div>
              ) : (
                // 数据库类型可编辑所有连接信息
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">名称</label>
                    <input
                      type="text"
                      value={basicForm.name}
                      onChange={(e) => updateBasicForm({ name: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">主机</label>
                      <input
                        type="text"
                        value={basicForm.host}
                        onChange={(e) => updateBasicForm({ host: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">端口</label>
                      <input
                        type="number"
                        value={basicForm.port}
                        onChange={(e) => updateBasicForm({ port: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">数据库</label>
                      <input
                        type="text"
                        value={basicForm.database}
                        onChange={(e) => updateBasicForm({ database: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">用户名</label>
                    <input
                      type="text"
                      value={basicForm.username}
                      onChange={(e) => updateBasicForm({ username: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">密码</label>
                    <input
                      type="password"
                      value={basicForm.password}
                      onChange={(e) => updateBasicForm({ password: e.target.value })}
                      onFocus={() => {
                        if (!hasPasswordFocus && basicForm.password === '••••••') {
                          updateBasicForm({ password: '' })
                          setHasPasswordFocus(true)
                        }
                      }}
                      placeholder="输入新密码以更新，留空则保持不变"
                      className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  {datasource.type === 'postgresql' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Schema</label>
                      <input
                        type="text"
                        value={basicForm.schema_name}
                        onChange={(e) => updateBasicForm({ schema_name: e.target.value })}
                        placeholder="默认为 public"
                        className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-primary"
                      />
                    </div>
                  )}

                  {/* 测试连接结果 */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="px-3 py-1.5 text-xs bg-dark-700 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {isTesting && <Loader2 className="w-3 h-3 animate-spin" />}
                      测试连接
                    </button>
                    {testResult === 'success' && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        连接成功
                      </span>
                    )}
                    {testResult === 'error' && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <XCircle className="w-3 h-3" />
                        {testError || '连接失败'}
                      </span>
                    )}
                  </div>
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
        )}
      </AnimatePresence>
    </>
  )
}
