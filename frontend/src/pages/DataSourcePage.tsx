import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  Plus,
  Trash2,
  Server,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Edit,
} from 'lucide-react'
import { datasourceApi } from '../services/api'
import type { DataSource } from '../types'
import EditDataSourceDrawer from '../components/EditDataSourceDrawer'

export default function DataSourcePage() {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingDatasource, setEditingDatasource] = useState<{
    id: string
    name: string
    type: string
    host?: string
    port?: number
    database_name?: string
    db_username?: string
    schema_name?: string
  } | null>(null)

  const { data: datasources = [], isLoading } = useQuery({
    queryKey: ['datasources'],
    queryFn: datasourceApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: datasourceApi.delete,
    onSuccess: () => {
      // 同时刷新数据源和会话列表缓存
      queryClient.invalidateQueries({ queryKey: ['datasources'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setDeleteId(null)
    },
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mysql':
        return '🐬'
      case 'postgresql':
        return '🐘'
      case 'sqlite':
        return '📦'
      default:
        return '💾'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mysql':
        return 'from-blue-500 to-blue-600'
      case 'postgresql':
        return 'from-indigo-500 to-indigo-600'
      case 'sqlite':
        return 'from-gray-500 to-gray-600'
      default:
        return 'from-gray-500 to-gray-600'
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-3xl font-bold text-white mb-2"
          >
            数据源管理
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400"
          >
            管理您的数据库连接
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Link to="/datasources/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            添加数据源
          </Link>
        </motion.div>
      </div>

      {/* DataSources Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
        </div>
      ) : datasources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {datasources.map((ds: DataSource, index: number) => (
              <motion.div
                key={ds.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card-hover p-6 group relative"
              >
                {/* Action Buttons */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => setEditingDatasource(ds)}
                    className="p-2 text-gray-500 hover:text-accent-primary hover:bg-accent-primary/10 rounded-lg transition-all"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(ds.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getTypeColor(ds.type)} flex items-center justify-center mb-4 text-2xl`}>
                  {getTypeIcon(ds.type)}
                </div>

                {/* Info */}
                <h3 className="font-display font-semibold text-white text-lg mb-2">
                  {ds.name}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Server className="w-4 h-4" />
                    <span>{ds.host}:{ds.port}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Database className="w-4 h-4" />
                    <span>{ds.database}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ds.status === 'connected' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">已连接</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">已断开</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action */}
                <Link
                  to={`/chat?datasource=${ds.id}`}
                  className="mt-4 flex items-center gap-2 text-accent-primary hover:text-accent-glow transition-colors text-sm font-medium"
                >
                  开始查询
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
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
            添加您的第一个数据源，开始智能数据分析
          </p>
          <Link to="/datasources/new" className="btn-primary inline-flex">
            添加数据源
          </Link>
        </motion.div>
      )}

      {/* Edit DataSource Drawer */}
      <EditDataSourceDrawer
        isOpen={!!editingDatasource}
        onClose={() => setEditingDatasource(null)}
        datasource={editingDatasource}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['datasources'] })}
      />

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
                确认删除数据源
              </h3>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <p className="text-red-400 text-sm mb-2">
                  ⚠️ 此操作不可撤销，将同时删除：
                </p>
                <ul className="text-gray-300 text-sm space-y-1 ml-4">
                  <li>• 该数据源的所有连接信息</li>
                  <li>• 关联的所有对话记录</li>
                  <li>• 对话中的所有消息内容</li>
                </ul>
              </div>
              <p className="text-gray-400 mb-6">
                确定要删除数据源「{datasources.find(d => d.id === deleteId)?.name}」吗？
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