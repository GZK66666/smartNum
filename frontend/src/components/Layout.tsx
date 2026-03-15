import { Outlet, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Database,
  MessageSquare,
  LogOut,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../store/auth'

export default function Layout() {
  const { user, logout } = useAuth()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '仪表盘' },
    { to: '/datasources', icon: Database, label: '数据源' },
    { to: '/chat', icon: MessageSquare, label: '对话' },
  ]

  return (
    <div className="min-h-screen bg-dark-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-mesh pointer-events-none" />
      <div className="fixed inset-0 bg-noise pointer-events-none" />

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        className="fixed left-0 top-0 bottom-0 w-64 bg-dark-800/50 backdrop-blur-xl border-r border-white/5 z-50"
      >
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-dark-900" />
            </div>
            <span className="font-display font-bold text-xl text-white">SmartNum</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-secondary to-accent-primary flex items-center justify-center text-dark-900 font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.username}</p>
              <p className="text-gray-500 text-sm">在线</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}