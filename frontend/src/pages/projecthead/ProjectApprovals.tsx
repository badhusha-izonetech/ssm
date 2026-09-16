import { approvals } from '../../data/mockData'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'

export default function ProjectApprovals() {
  const { projects } = useApp()
  const projectApprovals = approvals.filter((a) => a.department === 'Project')
  const escalated = projects.filter((p) => p.escalated)

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Project → Project Head" title="Approvals" />

      <Card className="p-4">
        <SectionHeading title="Pending Approvals (Project Department)" />
        {projectApprovals.length === 0 ? (
          <EmptyState title="Nothing pending" message="No approval requests raised from the Project department." />
        ) : (
          <div className="space-y-2">
            {projectApprovals.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{a.type}</div>
                  <div className="text-xs text-text-dim mt-0.5">{a.summary}</div>
                  <div className="text-xs text-text-dim mt-1">By {a.requestedBy} · {formatDate(a.raisedOn)}</div>
                </div>
                <Pill status={a.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeading title="Projects Escalated to CEO" />
        {escalated.length === 0 ? (
          <div className="text-xs text-text-dim">No projects currently escalated.</div>
        ) : (
          <div className="space-y-2">
            {escalated.map((p) => (
              <div key={p.id} className="border-t border-border pt-2.5 first:border-t-0 first:pt-0">
                <div className="text-sm font-medium">{p.projectCode} — {p.customerName}</div>
                <div className="text-xs text-rose mt-0.5">{p.escalationNote}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-3 text-[11px] text-text-dim">
        Approve/Reject authority for approval requests remains with the CEO Portal (Phase 1). This view is read-only for the Project Head, showing what's pending and what has been escalated.
      </Card>
    </div>
  )
}
