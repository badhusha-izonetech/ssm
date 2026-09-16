import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill, EmptyState } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { formatDate } from '../../lib/utils'
import { Wrench, MapPin, ClipboardCheck } from 'lucide-react'

const TODAY = '2026-08-14'

export default function TechnicianDashboard() {
  const { projects, fieldWorkLogs, finalVerifications } = useApp()
  const { employee } = useAuth()
  const navigate = useNavigate()

  const myProjects = useMemo(() => projects.filter((p) => p.assignedTechnicianId === employee?.id), [projects, employee])
  const active = myProjects.filter((p) => p.installationStatus === 'In Progress' || (p.installationStatus === 'Not Started' && p.warehouseStatus === 'Issued'))
  const upcoming = myProjects.filter((p) => p.installationStatus === 'Not Started' && p.warehouseStatus !== 'Issued')
  const readyForVerification = myProjects.filter(
    (p) => p.installationStatus === 'Completed' && p.balanceAmount === 0 && p.ebStatus === 'Meter Installed' && !finalVerifications.some((v) => v.projectId === p.id),
  )
  const completed = myProjects.filter((p) => p.status === 'Completed')
  const todaysLog = fieldWorkLogs.find((l) => l.technicianId === employee?.id && l.date === TODAY && !l.endOfDay)

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Field Technician"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Solar Installation, Site Work Logs & Verification Milestones"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => navigate('/technician/projects')} className="text-left"><KpiCard label="Active Installs" value={String(active.length)} accent="sun" /></button>
        <button onClick={() => navigate('/technician/projects')} className="text-left"><KpiCard label="Upcoming" value={String(upcoming.length)} accent="teal" /></button>
        <button onClick={() => navigate('/technician/projects')} className="text-left"><KpiCard label="Ready for Final Verification" value={String(readyForVerification.length)} accent="sun" /></button>
        <button onClick={() => navigate('/technician/projects')} className="text-left"><KpiCard label="Completed" value={String(completed.length)} accent="teal" /></button>
      </div>

      {todaysLog && (
        <Card className="p-4 border-sun/40 bg-sun/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sun/15 flex items-center justify-center shrink-0"><Wrench size={15} className="text-sun" /></div>
            <div className="min-w-0">
              <div className="text-sm font-medium">Work session in progress</div>
              <div className="text-xs text-text-dim">Started {todaysLog.startTime} · Minimum 1 update every 3 hours is required until End of Day is submitted.</div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <SectionHeading eyebrow="Action Needed" title="Today's Work" action={<span className="text-xs text-text-dim">{active.length} active</span>} />
        {active.length === 0 ? (
          <EmptyState title="No active installations" message="You have no installation in progress right now." />
        ) : (
          <div className="space-y-2">
            {active.map((p) => (
              <div key={p.id} onClick={() => navigate('/technician/projects')} className="flex items-center justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 cursor-pointer hover:bg-black/[0.02] -mx-1 px-1 rounded-lg transition-colors">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sun/10 flex items-center justify-center shrink-0"><Wrench size={15} className="text-sun" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.projectCode} — {p.customerName}</div>
                    <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><MapPin size={11} />{p.site}</div>
                  </div>
                </div>
                <Pill status={p.installationStatus} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {readyForVerification.length > 0 && (
        <Card className="p-4">
          <SectionHeading eyebrow="Next Step" title="Ready for Final Connection Verification" action={<ClipboardCheck size={15} className="text-teal" />} />
          <div className="space-y-2">
            {readyForVerification.map((p) => (
              <div key={p.id} onClick={() => navigate('/technician/projects')} className="flex items-center justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 cursor-pointer hover:bg-black/[0.02] -mx-1 px-1 rounded-lg transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.projectCode} — {p.customerName}</div>
                  <div className="text-xs text-text-dim">Due {formatDate(p.dueDate)}</div>
                </div>
                <Pill status="Ready" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
