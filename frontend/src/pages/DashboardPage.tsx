import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Database,
  MessageSquare,
  Plus,
  ArrowRight,
  TrendingUp,
  Zap,
  Activity,
} from 'lucide-react'
import { datasourceApi, sessionApi } from '../services/api'

export default function DashboardPage() {
  const { data: datasources = [] } = useQuery({
    queryKey: ['datasources'],
    queryFn: datasourceApi.list,
  })

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionApi.list(undefined, 5),
  })

  const sessions = sessionsData?.data || []

  const stats = [
    {
      label: '数据源',
      value: datasources.length,
      icon: Database,
      color: 'from-accent-primary to-accent-secondary',
    },
    {
      label: '会话数',
      value: sessions.length,
      icon: MessageSquare,
      color: 'from-accent-secondary to-blue-400',
    },
    {
      label: '查询次数',
      value: sessions.reduce((sum, s) => sum + s.message_count, 0),
      icon: TrendingUp,
      color: 'from-purple-400 to-pink-400',
    },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold text-white mb-2"
        >
          仪表盘
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400"
        >
          欢迎使用 SmartNum 智能问数系统
        </motion.p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card-hover p-6"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-dark-900" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <p className="font-display text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            to="/datasources/new"
            className="glass-card-hover p-6 flex items-center gap-4 group"
          >
            <div className="w-14 h-14 rounded-xl bg-accent-primary/10 flex items-center justify-center group-hover:bg-accent-primary/20 transition-colors">
              <Database className="w-7 h-7 text-accent-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-white mb-1">添加数据源</h3>
              <p className="text-gray-400 text-sm">连接您的数据库，开始智能分析</p>
            </div>
            <Plus className="w-5 h-5 text-gray-500 group-hover:text-accent-primary transition-colors" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link
            to="/chat"
            className="glass-card-hover p-6 flex items-center gap-4 group"
          >
            <div className="w-14 h-14 rounded-xl bg-accent-secondary/10 flex items-center justify-center group-hover:bg-accent-secondary/20 transition-colors">
              <MessageSquare className="w-7 h-7 text-accent-secondary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-white mb-1">开始对话</h3>
              <p className="text-gray-400 text-sm">使用自然语言查询您的数据</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-accent-secondary transition-colors" />
          </Link>
        </motion.div>
      </div>

      {/* Recent Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-white">最近会话</h2>
          <Link
            to="/chat"
            className="text-accent-primary hover:text-accent-glow transition-colors text-sm font-medium"
          >
            查看全部
          </Link>
        </div>

        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <Link
                  to={`/chat/${session.id}`}
                  className="glass-card-hover p-4 flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">
                      {session.title || '新对话'}
                    </h4>
                    <p className="text-gray-500 text-sm">
                      {session.datasource_name} · {session.message_count} 条消息
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">还没有会话记录</p>
            <Link to="/chat" className="btn-primary inline-flex">
              开始第一个对话
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}