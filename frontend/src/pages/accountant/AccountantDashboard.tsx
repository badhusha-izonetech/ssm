import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill, EmptyState } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { formatINR, formatDate } from '../../lib/utils'
import { PaymentVerificationModal } from '../../components/accountant/PaymentVerificationModal'
import type { Payment } from '../../types/models'

export default function AccountantDashboard() {
  const { payments, quotations } = useApp()
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Payment | null>(null)

  const queue = useMemo(() => payments.filter((p) => p.state === 'Pending' || p.state === 'Under Verification' || p.state === 'Proof Uploaded'), [payments])
  const verifiedToday = payments.filter((p) => p.state === 'Verified' && p.verifiedBy === employee?.name)
  const outstanding = useMemo(() => {
    let count = payments.filter((p) => p.expectedAmount - (p.verifiedAmount ?? p.actualAmount) > 0 && p.state !== 'Rejected').length
    quotations.forEach((q) => {
      if (q.balanceAmount > 0) {
        const advanceVerified = payments.some(p => p.quotationId === q.id && p.paymentType === 'Advance (50%)' && p.state === 'Verified')
        const balanceSubmitted = payments.some(p => p.quotationId === q.id && (p.paymentType === 'Balance Payment' || p.paymentType === 'Full Payment'))
        if (advanceVerified && !balanceSubmitted) count++
      }
    })
    return count
  }, [payments, quotations])
  const totalExpected = payments.reduce((s, p) => s + p.expectedAmount, 0)
  const totalReceived = payments.filter((p) => p.state === 'Verified' || p.state === 'Partial').reduce((s, p) => s + (p.verifiedAmount ?? p.actualAmount), 0)

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Accountant"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Payment verification, financial reconciliation & outstanding balances"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => navigate('/accountant/verification')} className="text-left"><KpiCard label="Verification Queue" value={String(queue.length)} accent="sun" /></button>
        <button onClick={() => navigate('/accountant/outstanding')} className="text-left"><KpiCard label="Outstanding" value={String(outstanding)} accent="rose" /></button>
        <KpiCard label="Total Expected" value={formatINR(totalExpected)} accent="sun" />
        <KpiCard label="Total Verified Received" value={formatINR(totalReceived)} accent="teal" />
      </div>

      <Card className="p-4">
        <SectionHeading eyebrow="Action Needed" title="Payment Verification Queue" action={<span className="text-xs text-text-dim">{queue.length} pending</span>} />
        {queue.length === 0 ? (
          <EmptyState title="Queue is clear" message="No partner-submitted payments are waiting on verification right now." />
        ) : (
          <div className="space-y-2">
            {queue.map((p) => (
              <div key={p.id} onClick={() => setSelected(p)} className="flex items-center justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 cursor-pointer hover:bg-black/[0.02] -mx-1 px-1 rounded-lg transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.customerName}</div>
                  <div className="text-xs text-text-dim">{p.paymentType} · Submitted {formatINR(p.actualAmount)} of {formatINR(p.expectedAmount)} · {formatDate(p.paymentDate)}</div>
                  <div className="text-xs text-text-dim">By {p.submittedBy}</div>
                </div>
                <Pill status={p.state} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeading eyebrow="Recent" title="Recently Verified by You" />
        {verifiedToday.length === 0 ? (
          <div className="text-xs text-text-dim">No payments verified yet.</div>
        ) : (
          <div className="space-y-2">
            {verifiedToday.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.customerName}</div>
                  <div className="text-xs text-text-dim">{p.paymentType} · Verified {formatINR(p.verifiedAmount ?? p.actualAmount)}</div>
                </div>
                <Pill status={p.state} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {selected && <PaymentVerificationModal payment={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
