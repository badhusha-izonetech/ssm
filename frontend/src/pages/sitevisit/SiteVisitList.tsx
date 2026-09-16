import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { ScheduleSiteVisitModal } from '../../components/sitevisit/ScheduleSiteVisitModal'
import { SiteVisitDetail } from '../../components/sitevisit/SiteVisitDetail'
import { Plus, MapPin, Search } from 'lucide-react'
import type { SiteVisit } from '../../types/models'

const TABS: { key: string; label: string; match?: (v: SiteVisit, today: string) => boolean; ceoOnly?: boolean }[] = [
  { key: 'requires-schedule', label: 'Requires Schedule' },
  { key: 'upcoming', label: 'Upcoming', match: (v, today) => v.status === 'Upcoming' && v.visitDate !== today },
  { key: 'today', label: 'Today', match: (v, today) => v.status === 'In Progress' || (v.status === 'Upcoming' && v.visitDate === today) },
  { key: 'completed-site', label: 'Completed (Site Visit)', match: (v) => v.status === 'Completed' && v.siteType !== 'Project Installation' && v.siteType !== 'Final Review' },
  { key: 'completed-tech', label: 'Completed (Field Tech)', match: (v) => v.status === 'Completed' && v.siteType === 'Project Installation', ceoOnly: true },
  { key: 'completed-feedback', label: 'Completed (Feedback)', match: (v) => v.status === 'Completed' && v.siteType === 'Final Review', ceoOnly: true },
  { key: 'revisit', label: 'Revisit Required', match: (v) => v.status === 'Revisit Required' },
  { key: 'rejected', label: 'Rejected / Infeasible', match: (v) => v.status === 'Rejected' },
]

const TODAY = new Date().toISOString().slice(0, 10)

export default function SiteVisitList() {
  const { siteVisits, leads } = useApp()
  const { employee, portal } = useAuth()
  const [tab, setTab] = useState('requires-schedule')
  const [search, setSearch] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [prefilledLeadId, setPrefilledLeadId] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mine = useMemo(() => siteVisits.filter((v) => portal === 'CEO' || v.employeeId === employee?.id), [siteVisits, employee, portal])

  const requiresSchedule = useMemo(() => {
    return leads.filter(
      (l) => l.status === 'Site Visit Required' && !siteVisits.some((v) => v.leadId === l.id && (v.status === 'Upcoming' || v.status === 'In Progress' || v.status === 'Completed'))
    ).filter((l) => !search.trim() || l.customerName.toLowerCase().includes(search.toLowerCase()) || l.area.toLowerCase().includes(search.toLowerCase()))
  }, [leads, siteVisits, search])

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.key === tab)!
    if (!activeTab.match) return []
    return mine
      .filter((v) => activeTab.match!(v, TODAY))
      .filter((v) => !search.trim() || v.customerName.toLowerCase().includes(search.toLowerCase()) || v.area.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.visitDate + a.visitTime).localeCompare(b.visitDate + b.visitTime))
  }, [mine, tab, search])

  const selected = selectedId ? siteVisits.find((v) => v.id === selectedId) ?? null : null

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="1st Site Visit"
        title="Site Visits"
        action={
          <button onClick={() => { setPrefilledLeadId(''); setShowSchedule(true); }} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition flex items-center gap-2">
            <Plus size={14} /> Schedule Visit
          </button>
        }
      />

      <div className="flex items-center gap-2.5 bg-panel border border-border shadow-xs rounded-xl px-3.5 py-2.5 max-w-sm">
        <Search size={15} className="text-text-dim shrink-0" />
        <input className="bg-transparent outline-none text-xs w-full placeholder:text-text-dim font-medium text-text" placeholder="Search customer or area…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 flex-wrap pb-1">
        {TABS.filter((t) => !t.ceoOnly || portal === 'CEO').map((t) => {
          const count = t.key === 'requires-schedule' ? requiresSchedule.length : mine.filter((v) => t.match!(v, TODAY)).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${tab === t.key ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs' : 'text-text-dim hover:text-text hover:bg-slate-100'}`}
            >
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {tab === 'requires-schedule' ? (
        requiresSchedule.length === 0 ? (
          <EmptyState title="All caught up" message="There are no leads currently awaiting a site visit." />
        ) : (
          <div className="space-y-2">
            {requiresSchedule.map((l) => (
              <Card key={l.id} className="p-4 flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text truncate">{l.customerName}</div>
                  <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><MapPin size={11} />{l.area} · {l.address}</div>
                  <div className="text-xs text-text-dim mt-1">{l.mobile} · {l.productInterested}</div>
                </div>
                <button
                  onClick={() => {
                    setPrefilledLeadId(l.id)
                    setShowSchedule(true)
                  }}
                  className="bg-panel-raised border border-border text-text text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-black/[0.035] transition-colors shrink-0 w-full sm:w-auto"
                >
                  Schedule Visit
                </button>
              </Card>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState title="No visits here" message="There are no site visits in this category right now." />
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <Card key={v.id} className="p-4 cursor-pointer hover:border-sun/40 transition-colors" onClick={() => setSelectedId(v.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text truncate">{v.customerName}</div>
                  <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><MapPin size={11} />{v.area} · {v.siteAddress}</div>
                  <div className="text-xs text-text-dim mt-1">{formatDate(v.visitDate)} · {v.visitTime} · {v.siteType}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Pill status={v.status} />
                  {v.feasibilityResult && <span className="text-[10px] text-text-dim">{v.feasibilityResult}</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showSchedule && <ScheduleSiteVisitModal initialLeadId={prefilledLeadId} onClose={() => { setShowSchedule(false); setPrefilledLeadId(''); }} />}
      {selected && <SiteVisitDetail visit={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
