import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { Pagination } from '../../components/shared/Pagination'

const TABS = ['All', 'Requested', 'Reserved', 'Issued', 'Shortage Flagged'] as const

export default function StockRequests() {
  const { stockRequests } = useApp()
  const [tab, setTab] = useState<(typeof TABS)[number]>('All')
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = useMemo(() => stockRequests.filter((r) => tab === 'All' || r.status === tab), [stockRequests, tab])
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Project → Project Head" title="Stock Requests" action={<span className="text-xs text-text-dim">{filtered.length} of {stockRequests.length}</span>} />

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = stockRequests.filter((r) => t === 'All' || r.status === t).length
          return (
            <button key={t} onClick={() => { setTab(t); setCurrentPage(1); }} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tab === t ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}>
              {t} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No requests" message="No stock requests match this view." />
      ) : (
        <div className="flex flex-col gap-2">
          {paginatedFiltered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text truncate">{r.itemName}</div>
                  <div className="text-xs text-text-dim mt-0.5">{r.projectCode} · {r.requiredQuantity} {r.unit}</div>
                  <div className="text-xs text-text-dim mt-1">Requested by {r.requestedBy} · {formatDate(r.requestedOn)}</div>
                  {r.notes && <div className="text-xs text-text-dim mt-1 italic">{r.notes}</div>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Pill status={r.status} />
                </div>
              </div>
            </Card>
          ))}
          <div className="drop-shadow-xs">
            <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      <Card className="p-3 text-[11px] text-text-dim">
        This is a live, read-only view of warehouse status for the Project Head. Reserve and Issue actions are performed by the Warehouse / Maintenance team on their Stock Requests screen — updates there (and Product Master receipts, returns, and adjustments) appear here instantly since both portals share the same stock data. Shortage flags do not trigger an automatic purchase workflow, per approved scope.
      </Card>
    </div>
  )
}
