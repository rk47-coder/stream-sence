import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, setAuthToken } from '../api/client'
import { AuthContext } from './authCtx.js'

const STORAGE_KEY = 'vs_token'

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(!!localStorage.getItem(STORAGE_KEY))

  const setToken = useCallback((t) => {
    setTokenState(t)
    if (t) localStorage.setItem(STORAGE_KEY, t)
    else localStorage.removeItem(STORAGE_KEY)
    setAuthToken(t)
  }, [])

  useEffect(() => {
    setAuthToken(token)
    if (!token) {
      setUser(null)
      setTenant(null)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/api/auth/me')
        if (!cancelled) {
          setUser(data.user)
          setTenant(data.tenant)
        }
      } catch {
        if (!cancelled) {
          setToken('')
          setUser(null)
          setTenant(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, setToken])

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/api/auth/login', { email, password })
      setToken(data.token)
      setUser(data.user)
      setTenant(data.tenant)
      return data
    },
    [setToken]
  )

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/api/auth/register', payload)
      setToken(data.token)
      setUser(data.user)
      setTenant(data.tenant)
      return data
    },
    [setToken]
  )

  const logout = useCallback(() => {
    setToken('')
    setUser(null)
    setTenant(null)
  }, [setToken])

  const value = useMemo(
    () => ({
      token,
      user,
      tenant,
      loading,
      login,
      register,
      logout,
      isAdmin: user?.role === 'admin',
      canUpload: user?.role === 'admin' || user?.role === 'editor',
    }),
    [token, user, tenant, loading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
