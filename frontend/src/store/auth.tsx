import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../services/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await authApi.getMe()
          setUser(userData)
        } catch {
          localStorage.removeItem('token')
          setToken(null)
        }
      }
      setIsLoading(false)
    }

    initAuth()
  }, [token])

  useEffect(() => {
    if (!isLoading) {
      const publicPaths = ['/login', '/register']
      if (!token && !publicPaths.includes(location.pathname)) {
        navigate('/login', { replace: true })
      } else if (token && publicPaths.includes(location.pathname)) {
        navigate('/', { replace: true })
      }
    }
  }, [token, isLoading, location.pathname, navigate])

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password })
    localStorage.setItem('token', res.access_token)
    setToken(res.access_token)
    setUser({
      user_id: res.user_id,
      username: res.username,
      email: res.email,
      status: 1,
    })
  }

  const register = async (username: string, password: string, email?: string) => {
    const res = await authApi.register({ username, password, email })
    localStorage.setItem('token', res.access_token)
    setToken(res.access_token)
    setUser({
      user_id: res.user_id,
      username: res.username,
      email: res.email,
      status: 1,
    })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}