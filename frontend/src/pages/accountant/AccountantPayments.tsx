import { useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatINR, formatDate } from '../../lib/utils'
import { Pagination } from '../../components/shared/Pagination'
import { PaymentVerificationModal } from '../../components/accountant/PaymentVerificationModal'
import type { Payment, Project } from '../../types/models'
import { ChevronDown, ChevronUp } from 'lucide-react'

const TABS: { key: string; label: string; match: (p: Payment, quotations?: any[]) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'queue', label: 'Verification Queue', match: (p) => p.state === 'Pending' || p.state === 'Under Verification' || p.state === 'Proof Uploaded' },
  { key: 'customer_approved', label: 'Customer Approved', match: (p, quotations) => {
    const q = quotations?.find((item) => item.id === p.quotationId)
    return q?.status === 'Customer Approved' || q?.status === 'Awaiting Advance' || (p.customerName !== '—' && !!p.customerName && p.customerName !== 'Other' && p.customerName !== 'Others')
  }},
  { key: 'advance', label: 'Advance Payments', match: (p) => p.paymentType === 'Advance (50%)' || p.paymentType === 'Advance' },
  { key: 'balance', label: 'Balance Payments', match: (p) => p.paymentType === 'Balance Payment' || p.paymentType === 'Full Payment' },
  { key: 'outstanding', label: 'Outstanding', match: () => false },
  { key: 'verified', label: 'Verified', match: (p) => p.state === 'Verified' },
  { key: 'rejected', label: 'Rejected', match: (p) => p.state === 'Rejected' },
]

function ProjectOutstandingCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false)
  const pb = project.paymentBreakdown
  if (!pb) return null

  return (
    <Card className="p-4 border border-border">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <div className="font-medium text-sm text-text">{project.customerName}</div>
          <div className="text-xs text-text-dim mt-0.5">Project: {project.projectCode}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-text-dim">Outstanding</div>
            <div className="text-sm font-semibold text-rose">{formatINR(pb.finalOutstanding)}</div>
          </div>
          <div className="text-text-dim hover:text-text transition-colors">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="col-span-1 md:col-span-2 text-xs font-semibold text-text-dim uppercase tracking-wider mb-1">Payment Breakdown</div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-dim">Total Project Value</span>
              <span className="font-medium">{formatINR(pb.totalAmount)}</span>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-border/50">
              <span className="text-text-dim">First 50% Required</span>
              <span>{formatINR(pb.first_50Required)}</span>
            </div>
            <div className="flex justify-between text-teal">
              <span>First 50% Paid</span>
              <span>{formatINR(pb.first_50Paid)}</span>
            </div>
            {pb.first_50Pending > 0 && (
              <div className="flex justify-between text-rose font-medium">
                <span>First 50% Pending</span>
                <span>{formatINR(pb.first_50Pending)}</span>
              </div>
            )}
            {pb.excessAdvanceGenerated > 0 && (
              <div className="flex justify-between text-sun">
                <span>Excess Credit Generated</span>
                <span>+{formatINR(pb.excessAdvanceGenerated)}</span>
              </div>
            )}
            {pb.verifiedAdditionalAdvance > 0 && (
              <div className="flex justify-between text-sun">
                <span>Verified Additional Advance</span>
                <span>+{formatINR(pb.verifiedAdditionalAdvance)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-dim">Second 50% Required</span>
              <span>{formatINR(pb.second_50Required)}</span>
            </div>
            {pb.advanceAdjusted > 0 && (
              <div className="flex justify-between text-sun">
                <span>Advance/Credit Adjusted</span>
                <span>-{formatINR(pb.advanceAdjusted)}</span>
              </div>
            )}
            <div className="flex justify-between text-teal">
              <span>Second 50% Paid</span>
              <span>{formatINR(pb.second_50Paid)}</span>
            </div>
            {pb.second_50Pending > 0 && (
              <div className="flex justify-between text-rose font-medium">
                <span>Second 50% Pending</span>
                <span>{formatINR(pb.second_50Pending)}</span>
              </div>
            )}
            {pb.second_50Excess > 0 && (
              <div className="flex justify-between text-sun">
                <span>Second 50% Excess</span>
                <span>+{formatINR(pb.second_50Excess)}</span>
              </div>
            )}
            <div className="border-t border-border/50 pt-2 mt-2 flex justify-between font-semibold">
              <span className="text-text">Final Outstanding</span>
              <span className="text-rose">{formatINR(pb.finalOutstanding)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function AccountantPayments() {
  const { payments, quotations, projects } = useApp()
  const [params] = useSearchParams()
  const location = useLocation()
  const routeDefault = location.pathname === '/accountant/verification' ? 'queue' : 'all'
  const initialTab = params.get('tab') ?? routeDefault
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : 'all')
  const [selected, setSelected] = useState<Payment | null>(null)

  const outstandingProjects = useMemo(
    () => projects.filter(p => p.paymentBreakdown && p.paymentBreakdown.finalOutstanding > 0),
    [projects]
  )

  const filtered = useMemo(() => {
    if (tab === 'outstanding') return outstandingProjects
    const activeTab = TABS.find((t) => t.key === tab)!
    return payments.filter((p) => activeTab.match(p, quotations))
  }, [payments, quotations, projects, tab, outstandingProjects])

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    TABS.forEach((t) => {
      if (t.key === 'outstanding') {
        counts[t.key] = outstandingProjects.length
      } else {
        counts[t.key] = payments.filter((p) => t.match(p, quotations)).length
      }
    })
    return counts
  }, [payments, quotations, outstandingProjects])

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Accounts → Accountant" title="Payment Verification & History" action={<span className="text-xs text-text-dim">{filtered.length} {tab === 'outstanding' ? 'projects' : 'payments'}</span>} />

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = tabCounts[t.key]
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setCurrentPage(1); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tab === t.key ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}
            >
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here" message="There are no records in this category yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {paginatedFiltered.map((item: any) => {
            if (tab === 'outstanding') {
              return <ProjectOutstandingCard key={item.id} project={item} />
            }

            const p = item as Payment
            const difference = (p.verifiedAmount ?? p.actualAmount) - p.expectedAmount
            return (
              <Card key={p.id} onClick={() => setSelected(p)} className="p-4 cursor-pointer hover:border-sun/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-text truncate">{p.customerName}</div>
                    <div className="text-xs text-text-dim mt-0.5">{p.paymentType} · {p.paymentMode} · Submitted by {p.submittedBy}</div>
                    <div className="text-xs text-text-dim mt-1">
                      Expected {formatINR(p.expectedAmount)} · Received <span className={p.actualAmount < p.expectedAmount ? 'text-sun' : 'text-teal'}>{formatINR(p.actualAmount)}</span>
                      {p.verifiedAmount !== undefined && <> · Verified {formatINR(p.verifiedAmount)}</>}
                    </div>
                    <div className="text-xs text-text-dim mt-1">{formatDate(p.paymentDate)} · Ref <span className="font-mono">{p.transactionReference || '—'}</span></div>
                    {p.followUpDate && <div className="text-xs text-sun mt-1">Follow-up: {formatDate(p.followUpDate)}</div>}
                    {p.remarks && <div className="text-xs text-text-dim mt-1 italic">"{p.remarks}"</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Pill status={p.state} />
                    {p.proofs && p.proofs.length > 0 && <img src={p.proofs[0].fileUrl} alt="Proof" className="w-14 h-14 object-cover rounded-lg border border-border" />}
                    {difference !== 0 && p.state !== 'Rejected' && p.state !== 'Pending' && (
                      <span className={`text-[11px] font-medium ${difference < 0 ? 'text-rose' : 'text-teal'}`}>{difference > 0 ? '+' : ''}{formatINR(difference)}</span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
          <div className="drop-shadow-xs mt-2">
            <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      {selected && <PaymentVerificationModal payment={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
