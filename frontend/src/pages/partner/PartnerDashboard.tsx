import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill, EmptyState } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { formatINR, formatDate } from '../../lib/utils'
import { PaymentSubmissionModal } from '../../components/partner/PaymentSubmissionModal'
import { Plus } from 'lucide-react'

export default function PartnerDashboard() {
  const { payments, quotations } = useApp()
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [showSubmit, setShowSubmit] = useState(false)

  const mine = useMemo(() => payments.filter((p) => p.submittedBy === employee?.name), [payments, employee])
  const approvedQuotations = useMemo(() => quotations.filter((q) => q.status === 'Customer Approved'), [quotations])

  const proofSubmitted = mine.filter((p) => p.state === 'Proof Uploaded')
  const underVerification = mine.filter((p) => p.state === 'Under Verification')
  const verified = mine.filter((p) => p.state === 'Verified')
  const rejected = mine.filter((p) => p.state === 'Rejected')

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Partner"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Partner Collections & Payment Submission Verification"
        action={
          <button onClick={() => setShowSubmit(true)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition flex items-center gap-2 cursor-pointer">
            <Plus size={14} /> Submit Payment
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button onClick={() => navigate('/partner/payments')} className="text-left"><KpiCard label="Customer Approved" value={String(approvedQuotations.length)} accent="sun" /></button>
        <button onClick={() => navigate('/partner/payments')} className="text-left"><KpiCard label="Proof Submitted" value={String(proofSubmitted.length)} accent="teal" /></button>
        <button onClick={() => navigate('/partner/payments')} className="text-left"><KpiCard label="Verification Pending" value={String(underVerification.length)} accent="sun" /></button>
        <button onClick={() => navigate('/partner/payments')} className="text-left"><KpiCard label="Verified" value={String(verified.length)} accent="teal" /></button>
        <button onClick={() => navigate('/partner/payments')} className="text-left"><KpiCard label="Rejected" value={String(rejected.length)} accent="rose" /></button>
      </div>

      <Card className="p-4">
        <SectionHeading eyebrow="Action Needed" title="Proof Submitted — Ready to Send for Verification" />
        {proofSubmitted.length === 0 ? (
          <EmptyState title="Nothing waiting" message="All submitted proofs have already been sent for verification." />
        ) : (
          <div className="space-y-2">
            {proofSubmitted.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.customerName}</div>
                  <div className="text-xs text-text-dim">{p.paymentType} · {formatINR(p.actualAmount)} · {formatDate(p.paymentDate)}</div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Pill status={p.state} />
                  {p.proofs && p.proofs.length > 0 && <img src={p.proofs[0].fileUrl} alt="Proof" className="w-10 h-10 object-cover rounded-lg border border-border" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeading eyebrow="Recent" title="Recent Submissions" />
        {mine.length === 0 ? (
          <div className="text-xs text-text-dim">No payments submitted yet.</div>
        ) : (
          <div className="space-y-2">
            {mine.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.customerName}</div>
                  <div className="text-xs text-text-dim">{p.paymentType} · Expected {formatINR(p.expectedAmount)} · Received {formatINR(p.actualAmount)}</div>
                </div>
                <Pill status={p.state} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {showSubmit && <PaymentSubmissionModal onClose={() => setShowSubmit(false)} />}
    </div>
  )
}
