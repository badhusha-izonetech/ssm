import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useMarketing } from '../../store/MarketingStore'
import { Card, SectionHeading, Pill, PriorityDot, Modal, Field, inputCls } from '../../components/shared/Primitives'
import type { Lead, LeadStatus } from '../../types/models'
import { formatDate } from '../../lib/utils'

const FOLLOW_UP_STATUSES: LeadStatus[] = ['Follow-up', 'Site Visit Required', 'Site Visit Scheduled', 'Interested', 'Contacted']
const NEXT_STATUS: LeadStatus[] = ['Interested', 'Site Visit Required', 'Quotation Stage', 'Not Interested']

export default function FollowUps() {
  const { employee, portal } = useAuth()
  const { leads, updateLeadStatus, callLogs } = useMarketing()
  const [active, setActive] = useState<Lead | null>(null)
  const [nextStatus, setNextStatus] = useState<LeadStatus>('Follow-up')
  const [remarks, setRemarks] = useState('')

  const due = useMemo(() => {
    const scoped = portal === 'Telecalling' ? leads.filter((l) => l.assignedEmployeeId === employee?.id) : leads
    return scoped
      .filter((l) => FOLLOW_UP_STATUSES.includes(l.status))
      .sort((a, b) => (a.firstContactDate < b.firstContactDate ? -1 : 1))
  }, [leads, portal, employee])

  function lastCall(leadId: string) {
    return callLogs.filter((c) => c.leadId === leadId).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!active) return
    updateLeadStatus(active.id, nextStatus, { remarks })
    setActive(null)
    setRemarks('')
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow={portal === 'Telecalling' ? 'Telecalling' : 'Direct / Field Marketing'}
        title="Follow-up"
        action={<span className="text-xs text-text-dim">{due.length} leads pending follow-up</span>}
      />

      <div className="space-y-3">
        {due.map((l) => {
          const call = lastCall(l.id)
          return (
            <Card key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-text">{l.customerName}</span>
                  <PriorityDot priority={l.priority} />
                  <Pill status={l.status} />
                  {l.remarks && (
                    <span className="text-xs text-slate-500 italic border-l border-slate-200 pl-2 max-w-[200px] truncate" title={l.remarks}>
                      {l.remarks}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-dim mt-0.5">{l.mobile} · {l.productInterested}</div>
                {call ? (
                  <div className="text-xs text-text-dim mt-1">
                    Last call {formatDate(call.date)} ({call.outcome}) — next follow-up {call.nextFollowUpDate ? formatDate(call.nextFollowUpDate) : '—'}
                  </div>
                ) : (
                  <div className="text-xs text-text-dim mt-1">First contact {formatDate(l.firstContactDate)} — no calls logged yet</div>
                )}
              </div>
              <button
                onClick={() => { setActive(l); setNextStatus(NEXT_STATUS.includes(l.status) ? l.status : NEXT_STATUS[0]) }}
                className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition shrink-0"
              >
                Record Outcome
              </button>
            </Card>
          )
        })}
        {due.length === 0 && (
          <Card className="p-8 text-center text-sm text-text-dim border-dashed">No leads pending follow-up right now.</Card>
        )}
      </div>

      {active && (
        <Modal title={`Record Outcome — ${active.customerName}`} onClose={() => setActive(null)}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Move to Status">
              <select className={inputCls} value={nextStatus} onChange={(e) => setNextStatus(e.target.value as LeadStatus)}>
                {NEXT_STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Remarks">
              <textarea className={inputCls} rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes for this follow-up" />
            </Field>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button type="button" onClick={() => setActive(null)} className="text-xs font-medium text-text-dim px-4 py-2 rounded-xl hover:bg-slate-100 transition">Cancel</button>
              <button type="submit" className="bg-emerald-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
