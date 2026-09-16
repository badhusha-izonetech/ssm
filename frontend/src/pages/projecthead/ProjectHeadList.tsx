import { useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Pill, PriorityDot, EmptyState } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { StageArc } from '../../components/shared/StageArc'
import { ProjectDetailDrawer } from '../../components/projecthead/ProjectDetailDrawer'
import { formatINR, formatDate } from '../../lib/utils'
import type { Project } from '../../types/models'

type TabDef = { key: string; label: string; match: (p: Project) => boolean }

const TABS: TabDef[] = [
  { key: 'all', label: 'All Projects', match: () => true },
  { key: 'new', label: 'New Projects', match: (p) => p.currentStage === 'Project Execution' && !p.assignedTechnicianId },
  { key: 'active', label: 'Active', match: (p) => (p.status === 'On Track' || p.status === 'Issue Raised') && p.currentStage !== 'Completed' },
  { key: 'delayed', label: 'Delayed', match: (p) => p.status === 'Delayed' },
  { key: 'hold', label: 'On Hold', match: (p) => p.status === 'On Hold' },
  { key: 'tech', label: 'Technician Assignment', match: (p) => !p.assignedTechnicianId && p.currentStage !== 'Completed' && p.currentStage !== 'Site Visit' && p.currentStage !== 'Quotation' },
  { key: 'doc', label: 'Document Assignment', match: (p) => !p.assignedDocEmployeeId && p.currentStage !== 'Completed' && p.currentStage !== 'Site Visit' && p.currentStage !== 'Quotation' },
]

export default function ProjectHeadList() {
  const { projects: allProjects } = useApp()
  const projects = allProjects.filter(p => !['Quotation', 'Site Visit', 'Awaiting Advance Payment', 'Advance Payment'].includes(p.currentStage))
  const { employees } = useAuth()
  const [params] = useSearchParams()
  const location = useLocation()
  const routeDefault = location.pathname === '/project-head/technicians' ? 'tech' : location.pathname === '/project-head/documents' ? 'doc' : 'all'
  const initialTab = params.get('tab') ?? routeDefault
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : 'all')
  const [selected, setSelected] = useState<Project | null>(null)

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.key === tab)!
    return projects.filter(activeTab.match)
  }, [projects, tab])

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  const columns: Column<Project>[] = [
    { header: 'Project', cell: (p) => (
      <div>
        <div className="font-medium text-text text-sm">{p.customerName}</div>
        <div className="text-text-dim text-[11px]">{p.projectCode}</div>
      </div>
    ) },
    { header: 'Site', cell: (p) => <span className="text-text-dim">{p.site}</span> },
    { header: 'Technician', cell: (p) => <span className="text-text-dim">{employees.find((e) => e.id === p.assignedTechnicianId)?.name ?? '—'}</span> },
    { header: 'Doc Employee', cell: (p) => <span className="text-text-dim">{employees.find((e) => e.id === p.assignedDocEmployeeId)?.name ?? '—'}</span> },
    { header: 'Stage', cell: (p) => <StageArc stage={p.currentStage} size="sm" /> },
    { header: 'Priority', cell: (p) => <PriorityDot priority={p.priority} /> },
    { header: 'Status', cell: (p) => <Pill status={p.status} /> },
    { header: 'Due', cell: (p) => <span className="text-text-dim">{formatDate(p.dueDate)}</span> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Project → Project Head" title="Projects" action={<span className="text-xs text-text-dim">{filtered.length} of {projects.length}</span>} />

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = projects.filter(t.match).length
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
        <EmptyState title="Nothing here" message="No projects match this view right now." />
      ) : (
        <div className="flex flex-col drop-shadow-xs">
          <DataTable
            columns={columns}
            rows={paginatedFiltered}
            keyFn={(p) => p.id}
            onRowClick={(p) => setSelected(p)}
            mobileCard={(p) => (
              <Card className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{p.projectCode}</div>
                    <div className="text-xs text-text-dim">{p.customerName} · {p.area}</div>
                  </div>
                  <Pill status={p.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-text-dim">
                  <span>{formatINR(p.projectValue)}</span>
                  <span>Due {formatDate(p.dueDate)}</span>
                </div>
                <StageArc stage={p.currentStage} size="sm" />
              </Card>
            )}
          />
          <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
        </div>
      )}

      {selected && <ProjectDetailDrawer project={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
