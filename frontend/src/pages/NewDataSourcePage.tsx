import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Loader2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  FileSpreadsheet,
} from 'lucide-react'
import { datasourceApi } from '../services/api'

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL', icon: '🐬', color: 'from-blue-500 to-blue-600' },
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘', color: 'from-indigo-500 to-indigo-600' },
  { value: 'sqlite', label: 'SQLite', icon: '📦', color: 'from-gray-500 to-gray-600' },
  { value: 'file', label: '文件', icon: '📄', color: 'from-green-500 to-green-600' },
]

const DEFAULT_PORTS: Record<string, number> = {
  mysql: 3306,
  postgresql: 5432,
  sqlite: 0,
  file: 0,
}

export default function NewDataSourcePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    name: '',
    type: 'mysql' as 'mysql' | 'postgresql' | 'sqlite' | 'file',
    host: 'localhost',
    port: 3306,
    database: '',
    username: '',
    password: '',
    schema_name: '',
  })

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const handleTypeChange = (type: string) => {
    updateForm({
      type: type as typeof form.type,
      port: DEFAULT_PORTS[type] || 0,
    })
    // Reset file state when changing type
    setSelectedFile(null)
    setTestResult('idle')
    setError('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setTestResult('idle')
      setError('')
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile || !form.name) return

    setIsSubmitting(true)
    setError('')

    try {
      await datasourceApi.uploadFile(form.name, selectedFile)
      queryClient.invalidateQueries({ queryKey: ['datasources'] })
      navigate('/datasources')
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async () => {
    setTestResult('idle')
    setError('')
    try {
      const result = await datasourceApi.test(form)
      setTestResult(result.success ? 'success' : 'error')
      if (!result.success) {
        setError(result.message || '连接失败')
      }
    } catch (err) {
      setTestResult('error')
      setError(err instanceof Error ? err.message : '连接失败')
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      await datasourceApi.create(form)
      // 使数据源列表缓存失效，返回列表页时会重新获取
      queryClient.invalidateQueries({ queryKey: ['datasources'] })
      navigate('/datasources')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/datasources')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          返回
        </button>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold text-white mb-2"
        >
          添加数据源
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400"
        >
          连接您的数据库
        </motion.p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                step >= s
                  ? 'bg-accent-primary text-dark-900'
                  : 'bg-dark-600 text-gray-400'
              }`}
            >
              {s}
            </div>
            <span className={step >= s ? 'text-white' : 'text-gray-500'}>
              {s === 1 ? '选择类型' : '配置连接'}
            </span>
            {s < 2 && (
              <div className={`w-12 h-0.5 ${step > s ? 'bg-accent-primary' : 'bg-dark-600'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Type */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-3">
              数据源名称
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              className="input-field"
              placeholder="例如：生产环境数据库"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-3">
              数据库类型
            </label>
            <div className="grid grid-cols-3 gap-4">
              {DB_TYPES.map((db) => (
                <button
                  key={db.value}
                  onClick={() => handleTypeChange(db.value)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    form.type === db.value
                      ? 'border-accent-primary bg-accent-primary/10'
                      : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${db.color} flex items-center justify-center mx-auto mb-3 text-2xl`}>
                    {db.icon}
                  </div>
                  <span className="font-medium text-white">{db.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!form.name}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            下一步
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Step 2: Configure Connection */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-5"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* File Type Configuration */}
          {form.type === 'file' && (
            <div className="space-y-4">
              {/* Upload Tips */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-300 font-medium mb-2">📋 表格格式要求</p>
                <ul className="text-blue-200/80 text-sm space-y-1 mb-3">
                  <li>• 第一行为表头（列名），不要有多余的标题行</li>
                  <li>• 每列数据类型保持一致</li>
                  <li>• 避免合并单元格</li>
                </ul>
                <p className="text-blue-300 text-sm font-medium mb-2">✅ 正确示例：</p>
                <div className="bg-dark-800 rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-blue-500/20">
                        <th className="px-2 py-1.5 text-left text-blue-200 font-medium">姓名</th>
                        <th className="px-2 py-1.5 text-left text-blue-200 font-medium">年龄</th>
                        <th className="px-2 py-1.5 text-left text-blue-200 font-medium">城市</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-400">
                      <tr className="border-t border-dark-600">
                        <td className="px-2 py-1.5">张三</td>
                        <td className="px-2 py-1.5">28</td>
                        <td className="px-2 py-1.5">北京</td>
                      </tr>
                      <tr className="border-t border-dark-600">
                        <td className="px-2 py-1.5">李四</td>
                        <td className="px-2 py-1.5">32</td>
                        <td className="px-2 py-1.5">上海</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* File Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-green-400" />
                    <div className="text-left">
                      <p className="text-white font-medium">{selectedFile.name}</p>
                      <p className="text-gray-400 text-sm">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-white font-medium mb-1">点击上传文件</p>
                    <p className="text-gray-400 text-sm">支持 CSV、XLSX、XLS 格式</p>
                    <p className="text-gray-500 text-xs mt-1">最大 50MB</p>
                  </div>
                )}
              </div>

              {/* Quick Preview */}
              {selectedFile && (
                <div className="bg-dark-700/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-white text-sm">{selectedFile.name}</p>
                      <p className="text-gray-400 text-xs">{(selectedFile.size / 1024).toFixed(1)} KB · 准备上传</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                    }}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    重新选择
                  </button>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                  上一步
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={isSubmitting || !selectedFile}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  创建
                </button>
              </div>
            </div>
          )}

          {/* Database Configuration */}
          {form.type !== 'file' && (
            <>
              {form.type !== 'sqlite' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        主机地址
                      </label>
                      <input
                        type="text"
                        value={form.host}
                        onChange={(e) => updateForm({ host: e.target.value })}
                        className="input-field"
                        placeholder="localhost"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        端口
                      </label>
                      <input
                        type="number"
                        value={form.port}
                        onChange={(e) => updateForm({ port: Number(e.target.value) })}
                        className="input-field"
                        placeholder="3306"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      数据库名称
                    </label>
                    <input
                      type="text"
                      value={form.database}
                      onChange={(e) => updateForm({ database: e.target.value })}
                      className="input-field"
                      placeholder="my_database"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        用户名
                      </label>
                      <input
                        type="text"
                        value={form.username}
                        onChange={(e) => updateForm({ username: e.target.value })}
                        className="input-field"
                        placeholder="root"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        密码
                      </label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => updateForm({ password: e.target.value })}
                        className="input-field"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {form.type === 'postgresql' && (
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Schema 名称
                      </label>
                      <input
                        type="text"
                        value={form.schema_name}
                        onChange={(e) => updateForm({ schema_name: e.target.value })}
                        className="input-field"
                        placeholder="public"
                      />
                    </div>
                  )}
                </>
              )}

              {form.type === 'sqlite' && (
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    数据库文件路径
                  </label>
                  <input
                    type="text"
                    value={form.database}
                    onChange={(e) => updateForm({ database: e.target.value })}
                    className="input-field"
                    placeholder="/path/to/database.db"
                  />
                </div>
              )}

              {/* Test Result */}
              {testResult !== 'idle' && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-3 ${
                    testResult === 'success'
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}
                >
                  {testResult === 'success' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <span className="text-green-400">连接成功</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-red-400">{error}</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                  上一步
                </button>
                <button
                  onClick={handleTest}
                  disabled={!form.database || (form.type !== 'sqlite' && (!form.username || !form.password))}
                  className="btn-secondary flex-1"
                >
                  测试连接
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || testResult !== 'success'}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  创建
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}