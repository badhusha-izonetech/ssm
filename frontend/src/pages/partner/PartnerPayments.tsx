import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatINR, formatDate } from '../../lib/utils'
import { Pagination } from '../../components/shared/Pagination'
import { PaymentSubmissionModal } from '../../components/partner/PaymentSubmissionModal'
import { Plus } from 'lucide-react'
import type { Payment } from '../../types/models'

const TABS: { key: string; label: string; match: (p: Payment) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'pending', label: 'Payment Pending', match: (p) => p.state === 'Pending' },
  { key: 'proof', label: 'Proof Submitted', match: (p) => p.state === 'Proof Uploaded' },
  { key: 'verification', label: 'Verification Pending', match: (p) => p.state === 'Under Verification' },
  { key: 'verified', label: 'Verified', match: (p) => p.state === 'Verified' },
  { key: 'rejected', label: 'Rejected', match: (p) => p.state === 'Rejected' },
]

export default function PartnerPayments() {
  const { payments } = useApp()
  const { employee } = useAuth()
  const [tab, setTab] = useState('all')
  const [showSubmit, setShowSubmit] = useState(false)
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | undefined>(undefined)

  const mine = useMemo(() => payments.filter((p) => p.submittedBy === employee?.name), [payments, employee])

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.key === tab)!
    return mine.filter((p) => activeTab.match(p))
  }, [mine, tab])

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Accounts → Partner"
        title="Payments"
        action={
          <button onClick={() => setShowSubmit(true)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition flex items-center gap-2">
            <Plus size={14} /> Submit Payment
          </button>
        }
      />

      <div className="flex gap-2 flex-wrap pb-1">
        {TABS.map((t) => {
          const count = mine.filter((p) => t.match(p)).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${tab === t.key ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs' : 'text-text-dim hover:text-text hover:bg-slate-100'}`}
            >
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No payments here" message="There are no payment records in this category yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {paginatedFiltered.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text truncate">{p.customerName}</div>
                  <div className="text-xs text-text-dim mt-0.5">{p.paymentType} · {p.paymentMode}</div>
                  <div className="text-xs text-text-dim mt-1">Expected {formatINR(p.expectedAmount)} · Received <span className={p.actualAmount < p.expectedAmount ? 'text-sun' : 'text-teal'}>{formatINR(p.actualAmount)}</span></div>
                  <div className="text-xs text-text-dim mt-1">{formatDate(p.paymentDate)} · Ref {p.transactionReference || '—'}</div>
                  {p.remarks && <div className="text-xs text-text-dim mt-1 italic">{p.remarks}</div>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Pill status={p.state} />
                  <div className="flex gap-2">
                    {(p.state === 'Pending' || p.state === 'Proof Uploaded') && (
                      <button onClick={() => setPaymentToEdit(p)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-border/50 text-text hover:bg-border transition-colors">Edit</button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          <div className="drop-shadow-xs">
            <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      {showSubmit && <PaymentSubmissionModal onClose={() => setShowSubmit(false)} />}
      {paymentToEdit && <PaymentSubmissionModal onClose={() => setPaymentToEdit(undefined)} editPayment={paymentToEdit} />}
    </div>
  )
}
