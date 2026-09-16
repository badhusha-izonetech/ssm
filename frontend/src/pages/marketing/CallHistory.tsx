import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useMarketing, type CallLogEntry } from '../../store/MarketingStore'
import { Card, SectionHeading, Pill, Modal, Field, inputCls } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'

const OUTCOMES: CallLogEntry['outcome'][] = ['Answered', 'Not Reachable', 'Call Back Requested', 'Switched Off', 'Wrong Number']

export default function CallHistory() {
  const { employee, portal } = useAuth()
  const { leads, callLogs, addCallLog } = useMarketing()
  const [showAdd, setShowAdd] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [outcome, setOutcome] = useState<CallLogEntry['outcome']>('Answered')
  const [notes, setNotes] = useState('')
  const [nextFollowUp, setNextFollowUp] = useState('')

  const scopedLeads = useMemo(
    () => (portal === 'Telecalling' ? leads.filter((l) => l.assignedEmployeeId === employee?.id) : leads),
    [leads, portal, employee],
  )
  const scopedLeadIds = new Set(scopedLeads.map((l) => l.id))
  const rows = useMemo(() => callLogs.filter((c) => scopedLeadIds.has(c.leadId)), [callLogs, scopedLeadIds])
  const [currentPage, setCurrentPage] = useState(1)
  const paginatedRows = useMemo(() => rows.slice((currentPage - 1) * 25, currentPage * 25), [rows, currentPage])

  function leadName(id: string) {
    return leads.find((l) => l.id === id)?.customerName ?? 'Unknown Lead'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!leadId || !employee) return
    const now = new Date()
    await addCallLog({
      leadId,
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      calledBy: employee.name,
      outcome,
      notes,
      nextFollowUpDate: nextFollowUp || undefined,
    })
    setLeadId(''); setNotes(''); setNextFollowUp(''); setOutcome('Answered')
    setShowAdd(false)
  }

  const columns: Column<CallLogEntry>[] = [
    { header: 'Customer', cell: (c) => <span className="font-medium text-text">{leadName(c.leadId)}</span> },
    { header: 'Date / Time', cell: (c) => <span className="text-text-dim">{c.date} · {c.time}</span> },
    { header: 'Called By', cell: (c) => c.calledBy },
    { header: 'Outcome', cell: (c) => <Pill status={c.outcome} /> },
    { header: 'Notes', cell: (c) => <span className="text-text-dim">{c.notes}</span> },
    { header: 'Next Follow-up', cell: (c) => <span className="text-text-dim">{c.nextFollowUpDate ?? '—'}</span> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow={portal === 'Telecalling' ? 'Telecalling' : 'Direct / Field Marketing'}
        title="Call History"
        action={
          <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">
            + Log Call
          </button>
        }
      />

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedRows}
          keyFn={(c) => c.id}
          mobileCard={(c) => (
            <Card className="p-4 space-y-1.5">
              <div className="flex justify-between items-start">
                <div className="font-semibold text-text">{leadName(c.leadId)}</div>
                <Pill status={c.outcome} />
              </div>
              <div className="text-xs text-text-dim">{c.date} · {c.time} · {c.calledBy}</div>
              <div className="text-xs text-text-dim">{c.notes}</div>
            </Card>
          )}
        />
        <Pagination currentPage={currentPage} totalItems={rows.length} onPageChange={setCurrentPage} />
      </div>

      {showAdd && (
        <Modal title="Log a Call" onClose={() => setShowAdd(false)}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Customer / Lead">
              <select required className={inputCls} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">Select lead…</option>
                {scopedLeads.map((l) => <option key={l.id} value={l.id}>{l.customerName} — {l.mobile}</option>)}
              </select>
            </Field>
            <Field label="Call Outcome">
              <select className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value as CallLogEntry['outcome'])}>
                {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <textarea required className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed on the call" />
            </Field>
            <Field label="Next Follow-up Date">
              <input type="date" className={inputCls} value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button type="button" onClick={() => setShowAdd(false)} className="text-xs font-medium text-text-dim px-4 py-2 rounded-xl hover:bg-slate-100 transition">Cancel</button>
              <button type="submit" className="bg-emerald-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">Save Call</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
