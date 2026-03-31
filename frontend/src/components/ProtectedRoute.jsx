import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children, adminOnly, editorOnly }) {
  const { token, user, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
        <p className="font-mono text-sm text-zinc-500">Loading session…</p>
      </div>
    )
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: loc }} />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  if (editorOnly && user.role === 'viewer') {
    return <Navigate to="/" replace />
  }

  return children
}
