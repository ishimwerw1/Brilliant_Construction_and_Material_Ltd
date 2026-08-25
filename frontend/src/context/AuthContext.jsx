import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bcml_user')) || null
    } catch {
      return null
    }
  })

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('bcml_token', data.data.token)
    localStorage.setItem('bcml_user', JSON.stringify(data.data.user))
    setUser(data.data.user)
    return data.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    localStorage.removeItem('bcml_token')
    localStorage.removeItem('bcml_user')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    localStorage.setItem('bcml_user', JSON.stringify(data.data.user))
    setUser(data.data.user)
  }, [])

  const hasPermission = useCallback(
    (permission) => {
      if (!user?.role) return false
      if (user.role.name === 'Super Admin') return true
      return (user.role.permissions || []).includes(permission)
    },
    [user]
  )

  const isSuperAdmin = user?.role?.name === 'Super Admin'

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, hasPermission, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
