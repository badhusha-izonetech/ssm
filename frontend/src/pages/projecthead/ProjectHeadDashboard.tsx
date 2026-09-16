import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill, EmptyState } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { StageArc } from '../../components/shared/StageArc'
import { formatINR, formatDate } from '../../lib/utils'
import { ProjectDetailDrawer } from '../../components/projecthead/ProjectDetailDrawer'
import type { Project } from '../../types/models'

export default function ProjectHeadDashboard() {
  const { projects: allProjects, stockRequests, projectIssues } = useApp()
  const projects = allProjects.filter(p => !['Quotation', 'Site Visit', 'Awaiting Advance Payment', 'Advance Payment'].includes(p.currentStage))
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Project | null>(null)

  const newProjects = projects.filter((p) => p.currentStage === 'Project Execution' && !p.assignedTechnicianId)
  const active = projects.filter((p) => (p.status === 'On Track' || p.status === 'Issue Raised') && p.currentStage !== 'Completed')
  const delayed = projects.filter((p) => p.status === 'Delayed')
  const onHold = projects.filter((p) => p.status === 'On Hold')
  const pendingStock = stockRequests.filter((r) => r.status === 'Requested' || r.status === 'Shortage Flagged')
  const openIssues = projectIssues.filter((i) => i.status === 'Open')

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Project Head"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Solar installation milestones, site tracking & technician allocations"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button onClick={() => navigate('/project-head/projects?tab=new')} className="text-left"><KpiCard label="New Projects" value={String(newProjects.length)} accent="sun" /></button>
        <button onClick={() => navigate('/project-head/projects?tab=active')} className="text-left"><KpiCard label="Active" value={String(active.length)} accent="teal" /></button>
        <button onClick={() => navigate('/project-head/projects?tab=delayed')} className="text-left"><KpiCard label="Delayed" value={String(delayed.length)} accent="rose" /></button>
        <button onClick={() => navigate('/project-head/projects?tab=hold')} className="text-left"><KpiCard label="On Hold" value={String(onHold.length)} accent="sun" /></button>
        <button onClick={() => navigate('/project-head/stock')} className="text-left"><KpiCard label="Stock Requests" value={String(pendingStock.length)} accent="rose" /></button>
        <button onClick={() => navigate('/project-head/issues')} className="text-left"><KpiCard label="Open Issues" value={String(openIssues.length)} accent="rose" /></button>
      </div>

      <Card className="p-4">
        <SectionHeading eyebrow="Action Needed" title="New Projects Awaiting Assignment" action={<span className="text-xs text-text-dim">{newProjects.length} project(s)</span>} />
        {newProjects.length === 0 ? (
          <EmptyState title="Nothing pending" message="No newly verified projects are waiting for technician assignment right now." />
        ) : (
          <div className="space-y-2">
            {newProjects.map((p) => (
              <div key={p.id} onClick={() => setSelected(p)} className="flex items-center justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 cursor-pointer hover:bg-black/[0.02] -mx-1 px-1 rounded-lg transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.projectCode} — {p.customerName}</div>
                  <div className="text-xs text-text-dim">{p.site} · {formatINR(p.projectValue)} · Due {formatDate(p.dueDate)}</div>
                </div>
                <StageArc stage={p.currentStage} size="sm" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionHeading eyebrow="Attention" title="Delayed Projects" />
          {delayed.length === 0 ? (
            <div className="text-xs text-text-dim">No delayed projects.</div>
          ) : (
            <div className="space-y-2">
              {delayed.map((p) => (
                <div key={p.id} onClick={() => setSelected(p)} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0 cursor-pointer hover:bg-black/[0.02] -mx-1 px-1 rounded-lg">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.projectCode}</div>
                    <div className="text-xs text-text-dim truncate">{p.nextAction}</div>
                  </div>
                  <Pill status={p.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeading eyebrow="Attention" title="Open Project Issues" />
          {openIssues.length === 0 ? (
            <div className="text-xs text-text-dim">No open issues.</div>
          ) : (
            <div className="space-y-2">
              {openIssues.map((i) => (
                <div key={i.id} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="text-sm font-medium">{i.projectCode}</div>
                  <div className="text-xs text-text-dim truncate">{i.description}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {selected && <ProjectDetailDrawer project={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
