import { useApp } from '../store/AppStore'
import { Card, SectionHeading, Pill, PriorityDot } from '../components/shared/Primitives'
import { formatDate } from '../lib/utils'
import { Check, X } from 'lucide-react'
import type { Approval, Department } from '../types/models'

export default function Approvals() {
  const { leaveRequests, decideLeave } = useApp()

  // Dynamically map actual store data into the Approval shape
  const items: Approval[] = [
    ...leaveRequests.map(
      (lr): Approval => ({
        id: lr.id,
        type: 'Leave Request',
        requestedBy: lr.employeeName,
        // Using 'CEO' or the actual employee department if available (hardcoding to CEO since LeaveRequest doesn't store department currently)
        department: 'CEO' as Department,
        summary: `${lr.leaveType} Leave (${lr.fromDate} to ${lr.toDate}) - ${lr.reason}`,
        raisedOn: lr.appliedOn,
        status: lr.status,
        priority: lr.leaveType === 'Emergency' ? 'High' : 'Medium',
      })
    ),
    // other approvals can be mapped here in the future
  ]

  function decide(id: string, type: Approval['type'], status: 'Approved' | 'Rejected') {
    if (type === 'Leave Request') {
      decideLeave(id, status)
    }
  }

  const pending = items.filter((a) => a.status === 'Pending')
  const decided = items.filter((a) => a.status !== 'Pending')

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="CEO Decisions" title="Approvals" action={<span className="text-xs text-text-dim px-2.5 py-1 rounded-full bg-panel-raised border border-border">{pending.length} pending</span>} />

      <div className="space-y-3">
        {pending.map((a) => (
          <Card key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-emerald-200 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium">{a.type}</span>
                <PriorityDot priority={a.priority} />
              </div>
              <div className="text-sm font-semibold text-text mt-1.5">{a.summary}</div>
              <div className="text-xs text-text-dim mt-0.5 flex items-center gap-1.5">
                <span>Raised by <strong className="text-text font-medium">{a.requestedBy}</strong> ({a.department})</span>
                <span>·</span>
                <span>{formatDate(a.raisedOn)}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => decide(a.id, a.type, 'Approved')} className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 transition">
                <Check size={14} /> Approve
              </button>
              <button onClick={() => decide(a.id, a.type, 'Rejected')} className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition">
                <X size={14} /> Reject
              </button>
            </div>
          </Card>
        ))}
        {pending.length === 0 && (
          <Card className="p-8 text-center text-sm text-text-dim border-dashed">
            No pending approvals.
          </Card>
        )}
      </div>

      <div className="pt-2">
        <div className="text-xs uppercase tracking-wider text-text-dim font-semibold mb-3">Decided History</div>
        <div className="space-y-2">
          {decided.map((a) => (
            <Card key={a.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text">{a.summary}</div>
                <div className="text-xs text-text-dim mt-0.5">{a.requestedBy} · {a.department}</div>
              </div>
              <Pill status={a.status} />
            </Card>
          ))}
          {decided.length === 0 && (
            <div className="text-xs text-text-dim">No historical decisions.</div>
          )}
        </div>
      </div>
    </div>
  )
}
