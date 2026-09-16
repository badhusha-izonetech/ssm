import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill, EmptyState } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { formatDate } from '../../lib/utils'
import { Truck, MapPin, PackageCheck } from 'lucide-react'

export default function TransportDashboard() {
  const { deliveries, fieldMovements } = useApp()
  const { employee } = useAuth()
  const navigate = useNavigate()

  const mine = useMemo(() => deliveries.filter((d) => d.assignedDriverId === employee?.id), [deliveries, employee])
  const today = '2026-08-14'
  const todaysTasks = mine.filter((d) => d.scheduledDate === today || d.status === 'Trip Started' || d.status === 'On Route' || d.status === 'Arrived' || d.status === 'Returning')
  const upcoming = mine.filter((d) => d.scheduledDate > today && d.status === 'Assigned')
  const completed = mine.filter((d) => d.status === 'Completed')
  const activeMovement = fieldMovements.find((f) => f.employeeId === employee?.id && f.status !== 'Checked Out')

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Transport"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Assigned Deliveries, Dispatch Coordination & Real-time GPS Tracking"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => navigate('/transport/tasks')} className="text-left"><KpiCard label="Today's Tasks" value={String(todaysTasks.length)} accent="sun" /></button>
        <button onClick={() => navigate('/transport/tasks')} className="text-left"><KpiCard label="Upcoming" value={String(upcoming.length)} accent="teal" /></button>
        <button onClick={() => navigate('/transport/tasks')} className="text-left"><KpiCard label="Completed Trips" value={String(completed.length)} accent="teal" /></button>
        <button onClick={() => navigate('/transport/movement')} className="text-left"><KpiCard label="GPS State" value={activeMovement ? 'Active' : 'Idle'} accent={activeMovement ? 'sun' : 'teal'} /></button>
      </div>

      <Card className="p-4">
        <SectionHeading
          eyebrow="Action Needed"
          title="Assigned Deliveries"
          action={<span className="text-xs text-text-dim">{todaysTasks.length} to action</span>}
        />
        {todaysTasks.length === 0 ? (
          <EmptyState title="No active deliveries" message="No delivery tasks are scheduled for today or currently in progress." />
        ) : (
          <div className="space-y-2">
            {todaysTasks.map((d) => (
              <div key={d.id} onClick={() => navigate('/transport/tasks')} className="flex items-center justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 cursor-pointer hover:bg-black/[0.02] -mx-1 px-1 rounded-lg transition-colors">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sun/10 flex items-center justify-center shrink-0">
                    <Truck size={15} className="text-sun" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.projectCode} — {d.customerName}</div>
                    <div className="text-xs text-text-dim truncate">{d.materialSummary}</div>
                    <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><MapPin size={11} />{d.pickup} → {d.destination}</div>
                  </div>
                </div>
                <Pill status={d.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionHeading eyebrow="Ahead" title="Upcoming Assignments" action={<span className="text-xs text-text-dim">{upcoming.length}</span>} />
          {upcoming.length === 0 ? (
            <div className="text-xs text-text-dim">No upcoming deliveries scheduled.</div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.projectCode} — {d.customerName}</div>
                    <div className="text-xs text-text-dim">{formatDate(d.scheduledDate)} · {d.materialSummary}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeading eyebrow="History" title="Recently Completed" action={<PackageCheck size={15} className="text-teal" />} />
          {completed.length === 0 ? (
            <div className="text-xs text-text-dim">No completed deliveries yet.</div>
          ) : (
            <div className="space-y-2">
              {completed.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.projectCode} — {d.customerName}</div>
                    <div className="text-xs text-text-dim">{formatDate(d.completedOn ?? d.scheduledDate)} · {d.materialSummary}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
