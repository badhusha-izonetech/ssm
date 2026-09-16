import type { Payment, Project } from '../types/models'

export interface ProjectRevenue {
  project: Project
  amountReceived: number
  accountantVerifiedAmount: number
  verificationPercentage: number
  verificationDate?: string
  isFullyVerified: boolean
}

export function dateKey(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function projectRevenue(projects: Project[], payments: Payment[]): ProjectRevenue[] {
  return projects.map((project) => {
    const projectPayments = payments.filter((payment) => payment.projectId === project.id && payment.state !== 'Rejected')
    const amountReceived = projectPayments.reduce((total, payment) => total + payment.actualAmount, 0)
    const verifiedPayments = projectPayments.filter((payment) => payment.verifiedAmount !== undefined && (payment.state === 'Verified' || payment.state === 'Partial'))
      .sort((a, b) => new Date(a.verifiedOn ?? a.paymentDate).getTime() - new Date(b.verifiedOn ?? b.paymentDate).getTime())
    const accountantVerifiedAmount = verifiedPayments.reduce((total, payment) => total + (payment.verifiedAmount ?? 0), 0)
    const verificationPercentage = project.projectValue > 0 ? Math.min(100, (accountantVerifiedAmount / project.projectValue) * 100) : 0
    let runningTotal = 0
    let verificationDate: string | undefined
    for (const payment of verifiedPayments) {
      runningTotal += payment.verifiedAmount ?? 0
      if (runningTotal >= project.projectValue) { verificationDate = payment.verifiedOn ?? payment.paymentDate; break }
    }
    return { project, amountReceived, accountantVerifiedAmount, verificationPercentage, verificationDate, isFullyVerified: verificationPercentage >= 100 }
  })
}

export function rangeFor(filter: string, customFrom: string, customTo: string) {
  const today = new Date()
  const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  if (filter === 'Today') return { from: key(today), to: key(today), label: 'Today' }
  if (filter === 'Yesterday') { const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); return { from: key(yesterday), to: key(yesterday), label: 'Yesterday' } }
  if (filter === 'This Week') return { from: key(startOfWeek), to: key(today), label: 'This Week' }
  if (filter === 'This Month') return { from: key(new Date(today.getFullYear(), today.getMonth(), 1)), to: key(today), label: 'This Month' }
  if (filter === 'This Year') return { from: `${today.getFullYear()}-01-01`, to: key(today), label: 'This Year' }
  return { from: customFrom, to: customTo, label: customFrom && customTo ? `${customFrom} to ${customTo}` : 'Custom range' }
}

export function inRange(value: string | undefined, from: string, to: string) {
  const key = dateKey(value)
  return Boolean(key && from && to && key >= from && key <= to)
}
