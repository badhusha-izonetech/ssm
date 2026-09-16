import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill, EmptyState } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { formatDate } from '../../lib/utils'
import { ScheduleSiteVisitModal } from '../../components/sitevisit/ScheduleSiteVisitModal'
import { SiteVisitDetail } from '../../components/sitevisit/SiteVisitDetail'
import { Plus, MapPin } from 'lucide-react'

const TODAY = new Date().toISOString().slice(0, 10)

export default function SiteVisitDashboard() {
  const { siteVisits, leads } = useApp()
  const { employee, portal } = useAuth()
  const navigate = useNavigate()
  const [showSchedule, setShowSchedule] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mine = useMemo(() => siteVisits.filter((v) => portal === 'CEO' || v.employeeId === employee?.id), [siteVisits, employee, portal])

  const todayVisits = mine.filter((v) => v.status === 'In Progress' || (v.status === 'Upcoming' && v.visitDate === TODAY))
  const upcoming = mine.filter((v) => v.status === 'Upcoming' && v.visitDate !== TODAY)
  const completed = mine.filter((v) => v.status === 'Completed')
  const revisit = mine.filter((v) => v.status === 'Revisit Required')
  const rejected = mine.filter((v) => v.status === 'Rejected')

  const requiresSchedule = useMemo(() => {
    return leads.filter(
      (l) => l.status === 'Site Visit Required' && !siteVisits.some((v) => v.leadId === l.id && (v.status === 'Upcoming' || v.status === 'In Progress' || v.status === 'Completed'))
    )
  }, [leads, siteVisits])

  const selected = selectedId ? siteVisits.find((v) => v.id === selectedId) ?? null : null

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Site Visit"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Site Assessment, Technical Feasibility & Customer Surveys"
        action={
          <button onClick={() => setShowSchedule(true)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition flex items-center gap-2 cursor-pointer">
            <Plus size={14} /> Schedule Visit
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button onClick={() => navigate('/site-visit/visits')} className="text-left"><KpiCard label="Requires Schedule" value={String(requiresSchedule.length)} accent="sun" /></button>
        <button onClick={() => navigate('/site-visit/visits')} className="text-left"><KpiCard label="Today" value={String(todayVisits.length)} accent="sun" /></button>
        <button onClick={() => navigate('/site-visit/visits')} className="text-left"><KpiCard label="Upcoming" value={String(upcoming.length)} accent="teal" /></button>
        <button onClick={() => navigate('/site-visit/visits')} className="text-left"><KpiCard label="Completed" value={String(completed.length)} accent="sun" /></button>
        <button onClick={() => navigate('/site-visit/visits')} className="text-left"><KpiCard label="Revisit Required" value={String(revisit.length)} accent="rose" /></button>
        <button onClick={() => navigate('/site-visit/visits')} className="text-left"><KpiCard label="Rejected / Infeasible" value={String(rejected.length)} accent="rose" /></button>
      </div>

      <Card className="p-4">
        <SectionHeading eyebrow="Today" title="Today's Visits" />
        {todayVisits.length === 0 ? (
          <EmptyState title="Nothing scheduled today" message="You have no site visits scheduled for today." />
        ) : (
          <div className="space-y-2">
            {todayVisits.map((v) => (
              <div key={v.id} onClick={() => setSelectedId(v.id)} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0 cursor-pointer hover:text-sun transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{v.customerName}</div>
                  <div className="text-xs text-text-dim flex items-center gap-1"><MapPin size={11} />{v.area} · {v.visitTime}</div>
                </div>
                <Pill status={v.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeading eyebrow="Ahead" title="Upcoming Visits" />
        {upcoming.length === 0 ? (
          <div className="text-xs text-text-dim">No upcoming visits scheduled.</div>
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 5).map((v) => (
              <div key={v.id} onClick={() => setSelectedId(v.id)} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0 cursor-pointer hover:text-sun transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{v.customerName}</div>
                  <div className="text-xs text-text-dim">{formatDate(v.visitDate)} · {v.visitTime} · {v.area}</div>
                </div>
                <Pill status={v.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {showSchedule && <ScheduleSiteVisitModal onClose={() => setShowSchedule(false)} />}
      {selected && <SiteVisitDetail visit={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
