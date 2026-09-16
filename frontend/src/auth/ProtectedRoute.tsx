import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { employee, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-text-dim text-sm">Loading session...</div>
  if (!employee) return <Navigate to="/login" replace />
  return <>{children}</>
}
