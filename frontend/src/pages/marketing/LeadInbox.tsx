import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useMarketing } from '../../store/MarketingStore'
import { Card, SectionHeading, Pill, PriorityDot, Modal, Field, inputCls } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { ScheduleSiteVisitModal } from '../../components/sitevisit/ScheduleSiteVisitModal'
import type { Lead, LeadStatus, LostReason } from '../../types/models'
import { formatDate } from '../../lib/utils'

const STATUS_OPTIONS: LeadStatus[] = ['New', 'Follow-up', 'Site Visit Required', 'Interested', 'Not Interested', 'Converted']
const LOST_REASONS: LostReason[] = ['Price', 'Product Unavailable', 'Company Cannot Provide Requirement', 'Customer Postponed', 'Competitor', 'Not Interested', 'Technical Infeasibility', 'Other']
import { AddLeadModal } from '../../components/marketing/AddLeadModal'

export default function LeadInbox() {
  const { employee, portal, employees } = useAuth()
  const { leads, updateLeadStatus } = useMarketing()
  const [status, setStatus] = useState('All Status')
  const [showAdd, setShowAdd] = useState(false)
  const [statusLead, setStatusLead] = useState<Lead | null>(null)
  const [newStatus, setNewStatus] = useState<LeadStatus>('New')
  const [lostReason, setLostReason] = useState<LostReason>('Price')
  const [lostDetail, setLostDetail] = useState('')
  const [showScheduleSiteVisit, setShowScheduleSiteVisit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const scoped = useMemo(
    () => (portal === 'Telecalling' ? leads.filter((l) => l.assignedEmployeeId === employee?.id) : leads),
    [leads, portal, employee],
  )
  const filtered = useMemo(() => scoped.filter((l) => status === 'All Status' || l.status === status), [scoped, status])
  const [currentPage, setCurrentPage] = useState(1)
  const paginatedList = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  async function submitStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!statusLead) return
    setIsSubmitting(true)
    setError('')
    try {
      await updateLeadStatus(
        statusLead.id,
        newStatus,
        newStatus === 'Not Interested' ? { lostReason, lostReasonDetail: lostDetail } : undefined,
      )
      setStatusLead(null)
      setLostDetail('')
    } catch (err: any) {
      const detail = err.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(', '));
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to update status');
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: Column<Lead>[] = [
    { header: 'Customer', cell: (l) => (
      <div>
        <div className="font-medium text-text">{l.customerName}</div>
        <div className="text-xs text-text-dim">{l.mobile} · {l.area}</div>
        {l.paymentType && <div className="text-[10px] text-teal mt-0.5 font-medium uppercase">{l.paymentType}</div>}
      </div>
    ) },
    { header: 'Requirement', cell: (l) => <span className="text-text-dim">{l.productInterested}</span> },
    { header: 'Source', cell: (l) => l.leadSource },
    { header: 'Assigned To', cell: (l) => employees.find((e) => e.id === l.assignedEmployeeId)?.name ?? '—' },
    { header: 'Priority', cell: (l) => <PriorityDot priority={l.priority} /> },
    { header: 'Status', cell: (l) => <Pill status={l.status} /> },
    { header: 'First Contact', cell: (l) => <span className="text-text-dim">{formatDate(l.firstContactDate)}</span> },
    { header: '', cell: (l) => (
      <div className="flex gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); setStatusLead(l); setNewStatus(l.status) }}
          className="text-xs text-sun hover:underline"
        >
          Update
        </button>
      </div>
    ) },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow={portal === 'Telecalling' ? 'Telecalling' : 'Direct / Field Marketing'}
        title="Lead Inbox"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowScheduleSiteVisit(true)} className="bg-white border border-border text-slate-700 hover:bg-slate-50 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition">
              Schedule Site Visit
            </button>
            <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">
              + Add Lead
            </button>
          </div>
        }
      />

      <Card className="p-3.5 flex flex-wrap gap-2.5 items-center justify-between">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-panel border border-border rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 shadow-xs transition">
          <option>All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-text-dim font-medium">{filtered.length} of {scoped.length} leads</span>
      </Card>

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedList}
          keyFn={(l) => l.id}
          mobileCard={(l) => (
            <Card className="p-4 space-y-1.5">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-text">{l.customerName}</span>
                <PriorityDot priority={l.priority} />
              </div>
              <div className="text-xs text-text-dim">{l.mobile} · {l.area}</div>
              <div className="text-xs font-medium text-emerald-700">{l.productInterested}</div>
              <div className="pt-2 flex justify-between items-center border-t border-border/70">
                <Pill status={l.status} />
                <button onClick={() => { setStatusLead(l); setNewStatus(l.status) }} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">Update status →</button>
              </div>
            </Card>
          )}
        />
        <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
      </div>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} />}

      {statusLead && (
        <Modal title={`Update Status — ${statusLead.customerName}`} onClose={() => setStatusLead(null)}>
          {error && <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3.5 py-2.5">{error}</div>}
          <form onSubmit={submitStatus} className="space-y-3">
            <Field label="Status">
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as LeadStatus)} className={inputCls}>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            {newStatus === 'Not Interested' && (
              <>
                <Field label="Lost Reason">
                  <select className={inputCls} value={lostReason} onChange={(e) => setLostReason(e.target.value as LostReason)}>
                    {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Reason Detail">
                  <textarea required className={inputCls} rows={3} value={lostDetail} onChange={(e) => setLostDetail(e.target.value)} placeholder="Capture the actual reason given by the customer" />
                </Field>
              </>
            )}
            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button type="button" onClick={() => setStatusLead(null)} className="text-xs font-medium text-text-dim px-4 py-2 rounded-xl hover:bg-slate-100 transition" disabled={isSubmitting}>Cancel</button>
              <button type="submit" disabled={isSubmitting} className="bg-emerald-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showScheduleSiteVisit && <ScheduleSiteVisitModal onClose={() => setShowScheduleSiteVisit(false)} />}
    </div>
  )
}
