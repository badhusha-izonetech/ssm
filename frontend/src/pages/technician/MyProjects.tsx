import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { Pagination } from '../../components/shared/Pagination'
import { TechnicianSiteVisitDetail } from './TechnicianSiteVisitDetail'
import { MapPin, Search, Wrench } from 'lucide-react'
import type { Project } from '../../types/models'

const TABS: { key: string; label: string; match: (p: Project) => boolean }[] = [
  { key: 'active', label: 'Active', match: (p) => p.installationStatus === 'In Progress' },
  { key: 'upcoming', label: 'Upcoming', match: (p) => p.installationStatus === 'Not Started' },
  { key: 'verification', label: 'Final Verification', match: (p) => p.installationStatus === 'Completed' && p.currentStage !== 'Completed' },
  { key: 'completed', label: 'Completed', match: (p) => p.status === 'Completed' },
]

export default function MyProjects() {
  const { projects } = useApp()
  const { employee } = useAuth()
  const [tab, setTab] = useState('active')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mine = useMemo(() => projects.filter((p) => p.assignedTechnicianId === employee?.id), [projects, employee])

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.key === tab)!
    return mine
      .filter((p) => activeTab.match(p))
      .filter((p) => !search.trim() || p.customerName.toLowerCase().includes(search.toLowerCase()) || p.projectCode.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      })
  }, [mine, tab, search])

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  if (selectedId) {
    const project = projects.find(p => p.id === selectedId)
    if (project) {
      return (
        <TechnicianSiteVisitDetail 
          project={project} 
          onBack={() => setSelectedId(null)} 
        />
      )
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Field Technician" title="My Projects" />

      <div className="flex items-center gap-2 bg-panel-raised border border-border rounded-lg px-3 py-2 max-w-sm">
        <Search size={14} className="text-text-dim shrink-0" />
        <input className="bg-transparent outline-none text-xs w-full placeholder:text-text-dim" placeholder="Search customer or project…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = mine.filter((p) => t.match(p)).length
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setCurrentPage(1); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tab === t.key ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}
            >
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No projects here" message="There are no projects in this category right now." />
      ) : (
        <div className="flex flex-col gap-2">
          {paginatedFiltered.map((p) => (
            <Card key={p.id} className="p-4 cursor-pointer hover:border-sun/40 transition-colors" onClick={() => setSelectedId(p.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sun/10 flex items-center justify-center shrink-0">
                    <Wrench size={15} className="text-sun" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-text truncate">{p.projectCode} — {p.customerName}</div>
                    <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><MapPin size={11} />{p.site}</div>
                    <div className="text-xs text-text-dim mt-0.5">{p.capacityKw} kW · Due {formatDate(p.dueDate)}</div>
                  </div>
                </div>
                <Pill status={p.installationStatus} />
              </div>
            </Card>
          ))}
          <div className="drop-shadow-xs">
            <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

    </div>
  )
}
