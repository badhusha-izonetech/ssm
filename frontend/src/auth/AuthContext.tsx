import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Employee } from '../types/models'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'

export type PortalKey = 'CEO' | 'Telecalling' | 'Direct Marketing' | 'Site Visit' | 'Partner' | 'Accountant' | 'Project Head' | 'Warehouse' | 'Transport' | 'Field Technician' | 'Document Follow-up' | 'Quotation Dashboard'

interface AuthState {
  employee: Employee | null
  portal: PortalKey | null
  employees: Employee[]
  loading: boolean
  login: (username: string, password?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  refreshEmployees: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [portal, setPortal] = useState<PortalKey | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      Promise.all([
        authApi.me(),
        import('../api/employees').then(m => m.employeesApi.getAll())
      ])
        .then(([meData, empData]) => {
          setEmployee(meData.employee)
          setPortal(meData.portal as PortalKey | null)
          setEmployees(empData)
        })
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login: AuthState['login'] = async (username, password) => {
    try {
      if (!username || !password) return { ok: false, error: 'Username and password required' }
      const res = await authApi.login(username, password)
      localStorage.setItem('access_token', res.access_token)
      localStorage.setItem('refresh_token', res.refresh_token)
      
      try {
        const empApi = await import('../api/employees')
        const empData = await empApi.employeesApi.getAll()
        setEmployees(empData)
      } catch (err) {
        console.error('Failed to fetch employees on login', err)
      }

      setEmployee(res.employee)
      setPortal(res.portal as PortalKey | null)
      return { ok: true }
    } catch (err: any) {
      let msg = 'Login failed'
      if (err instanceof ApiError && err.data?.detail) {
        msg = err.data.detail
      }
      return { ok: false, error: msg }
    }
  }

  const logout = () => {
    authApi.logout()
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setEmployee(null)
    setPortal(null)
    window.location.href = '/login'
  }

  const refreshEmployees = async () => {
    try {
      const empApi = await import('../api/employees')
      const empData = await empApi.employeesApi.getAll()
      setEmployees(empData)
    } catch (err) {
      console.error('Failed to refresh employees', err)
    }
  }

  return (
    <AuthContext.Provider value={{ employee, portal, employees, loading, login, logout, refreshEmployees }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    // This can happen during Vite HMR when a stale component re-renders before
    // the new AuthProvider has mounted. Return a safe loading default so the
    // app doesn't hard-crash; ProtectedRoute will redirect to /login anyway.
    return {
      employee: null,
      portal: null,
      employees: [],
      loading: true,
      login: async () => ({ ok: false, error: 'Not ready' }),
      logout: () => { window.location.href = '/login' },
      refreshEmployees: async () => {},
    }
  }
  return ctx
}
