import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, EmptyState } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import type { ProjectAllocation } from '../../types/models'

export default function ProjectAllocations() {
  const { projectAllocations, projects } = useApp()
  const [projectFilter, setProjectFilter] = useState('All Projects')

  const projectCodes = useMemo(() => ['All Projects', ...Array.from(new Set(projectAllocations.map((a) => a.projectCode)))], [projectAllocations])
  const filtered = useMemo(
    () => projectAllocations.filter((a) => projectFilter === 'All Projects' || a.projectCode === projectFilter),
    [projectAllocations, projectFilter],
  )
  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  const columns: Column<ProjectAllocation>[] = [
    { header: 'Project', cell: (a) => {
      const p = projects.find((pr) => pr.id === a.projectId)
      return (
        <div>
          <div className="font-medium text-text">{a.projectCode}</div>
          <div className="text-xs text-text-dim">{p?.customerName ?? '—'}</div>
        </div>
      )
    } },
    { header: 'Item', cell: (a) => a.itemName },
    { header: 'Required', cell: (a) => `${a.requiredQuantity} ${a.unit}` },
    { header: 'Reserved', cell: (a) => <span className="text-sun">{a.reservedQuantity} {a.unit}</span> },
    { header: 'Issued', cell: (a) => <span className="text-teal">{a.issuedQuantity} {a.unit}</span> },
    { header: 'Used', cell: (a) => `${a.usedQuantity} ${a.unit}` },
    { header: 'Returned', cell: (a) => `${a.returnedQuantity} ${a.unit}` },
    { header: 'Balance', cell: (a) => {
      const balance = a.issuedQuantity - a.usedQuantity - a.returnedQuantity
      return <span className={balance > 0 ? 'font-medium text-sun' : 'font-medium text-text-dim'}>{balance} {a.unit}</span>
    } },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Warehouse → Accountability" title="Project Material Allocation" action={<span className="text-xs text-text-dim">{filtered.length} of {projectAllocations.length}</span>} />

      <Card className="p-3">
        <div className="flex gap-1.5 flex-wrap">
          {projectCodes.map((c) => (
            <button key={c} onClick={() => { setProjectFilter(c); setCurrentPage(1); }} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${projectFilter === c ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}>
              {c}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="No allocations yet" message="Material allocations appear here once stock is reserved or issued against a project." />
      ) : (
        <div className="flex flex-col drop-shadow-xs">
          <DataTable
            columns={columns}
            rows={paginatedFiltered}
            keyFn={(a) => a.id}
            mobileCard={(a) => {
              const balance = a.issuedQuantity - a.usedQuantity - a.returnedQuantity
              return (
                <Card className="p-4">
                  <div className="font-medium text-sm text-text">{a.projectCode}</div>
                  <div className="text-xs text-text-dim mb-2">{a.itemName}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-text-dim">Required</div><div className="font-medium">{a.requiredQuantity} {a.unit}</div></div>
                    <div><div className="text-text-dim">Reserved</div><div className="font-medium text-sun">{a.reservedQuantity} {a.unit}</div></div>
                    <div><div className="text-text-dim">Issued</div><div className="font-medium text-teal">{a.issuedQuantity} {a.unit}</div></div>
                    <div><div className="text-text-dim">Used</div><div className="font-medium">{a.usedQuantity} {a.unit}</div></div>
                    <div><div className="text-text-dim">Returned</div><div className="font-medium">{a.returnedQuantity} {a.unit}</div></div>
                    <div><div className="text-text-dim">Balance</div><div className="font-medium text-sun">{balance} {a.unit}</div></div>
                  </div>
                </Card>
              )
            }}
          />
          <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
        </div>
      )}

      <Card className="p-3 text-[11px] text-text-dim">
        "Used" quantities (materials consumed on-site) are recorded by the Field Technician portal, planned for Phase 10 — this frontend keeps the column visible for the backend team's reference and defaults it to 0 until that module is built.
      </Card>
    </div>
  )
}
