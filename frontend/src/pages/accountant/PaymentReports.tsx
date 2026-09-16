import { useMemo } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, KpiCard } from '../../components/shared/Primitives'
import { formatINR } from '../../lib/utils'

export default function PaymentReports() {
  const { payments, projects } = useApp()

  const byMode = useMemo(() => {
    const map = new Map<string, number>()
    payments.forEach((p) => {
      if (p.state !== 'Verified' && p.state !== 'Partial') return
      const amt = Number((p.verifiedAmount ?? p.actualAmount) || 0)
      map.set(p.paymentMode || 'Unknown', (map.get(p.paymentMode || 'Unknown') ?? 0) + amt)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [payments])

  const byType = useMemo(() => {
    const map = new Map<string, number>()
    payments.forEach((p) => {
      if (p.state !== 'Verified' && p.state !== 'Partial') return
      const amt = Number((p.verifiedAmount ?? p.actualAmount) || 0)
      map.set(p.paymentType, (map.get(p.paymentType) ?? 0) + amt)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [payments])

  const totalExpected = payments.reduce((s, p) => s + Number(p.expectedAmount || 0), 0)
  const totalVerified = payments.filter((p) => p.state === 'Verified' || p.state === 'Partial').reduce((s, p) => s + Number((p.verifiedAmount ?? p.actualAmount) || 0), 0)
  
  // Outstanding is the sum of balance amounts across all active projects
  const totalOutstanding = projects
    ? projects.reduce((s, p) => s + Number(p.balanceAmount || 0), 0)
    : 0

  const rejectedCount = payments.filter((p) => p.state === 'Rejected').length

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Accounts → Accountant" title="Payment Reports" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Expected" value={formatINR(totalExpected)} accent="sun" />
        <KpiCard label="Total Verified" value={formatINR(totalVerified)} accent="teal" />
        <KpiCard label="Total Outstanding" value={formatINR(totalOutstanding)} accent="rose" />
        <KpiCard label="Rejected Submissions" value={String(rejectedCount)} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionHeading title="Verified Amount by Payment Mode" />
          <div className="space-y-2.5">
            {byMode.map(([mode, amt]) => (
              <div key={mode} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs text-text-dim">{mode}</div>
                <div className="flex-1 h-2 rounded-full bg-black/[0.04] overflow-hidden">
                  <div className="h-full bg-teal rounded-full" style={{ width: `${(amt / (totalVerified || 1)) * 100}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-xs font-medium">{formatINR(amt)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeading title="Verified Amount by Payment Type" />
          <div className="space-y-2.5">
            {byType.map(([type, amt]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs text-text-dim">{type}</div>
                <div className="flex-1 h-2 rounded-full bg-black/[0.04] overflow-hidden">
                  <div className="h-full bg-sun rounded-full" style={{ width: `${(amt / (totalVerified || 1)) * 100}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-xs font-medium">{formatINR(amt)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4 text-xs text-text-dim">
        Reports are generated live from mock payment records for this demo session. In production these will be filterable by date range, project, and department, and exportable as PDF/Excel.
      </Card>
    </div>
  )
}
