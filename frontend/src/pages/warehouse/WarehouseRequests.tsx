import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { Pagination } from '../../components/shared/Pagination'

const TABS = ['All', 'Requested', 'Reserved', 'Issued', 'Shortage Flagged', 'Pending Site Stock Check'] as const

export default function WarehouseRequests() {
  const { groupedStockRequests, stockItems, reserveProjectStockRequest, issueStockRequest, siteVisits, markSiteVisitStockAvailable } = useApp()
  const { employee } = useAuth()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Requested')
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = useMemo(() => groupedStockRequests.filter((p) => tab === 'All' || p.overallStatus === tab), [groupedStockRequests, tab])
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])
  const pendingSiteVisits = useMemo(() => siteVisits.filter(v => 
    (!v.stockAvailabilityStatus || v.stockAvailabilityStatus === 'Pending Check') && 
    v.rawMaterialDetails && v.rawMaterialDetails.length > 0
  ), [siteVisits])

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Warehouse → Project Requests" title="Stock Requests" action={<span className="text-xs text-text-dim">{filtered.length} of {groupedStockRequests.length} Projects</span>} />

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = t === 'Pending Site Stock Check' ? pendingSiteVisits.length : groupedStockRequests.filter((p) => t === 'All' || p.overallStatus === t).length
          return (
            <button key={t} onClick={() => { setTab(t); setCurrentPage(1); }} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tab === t ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}>
              {t} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {(tab === 'All' || tab === 'Pending Site Stock Check') && pendingSiteVisits.length > 0 && (
        <div className="space-y-2 mb-6">
          <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">Pending Site Visit Stock Checks ({pendingSiteVisits.length})</div>
          {pendingSiteVisits.map((v) => (
            <Card key={v.id} className="p-4 border-sun/30 bg-sun/[0.02]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text truncate">{v.customerName}</div>
                  <div className="text-xs text-text-dim mt-0.5">Site Visit Verification</div>
                  <div className="mt-2 text-xs">
                    <div className="text-text-dim">Products:</div>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {v.rawMaterialDetails?.map((rm, i) => (
                        <li key={i}>{rm.itemName} <span className="text-text-dim">(Qty: {rm.quantity})</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Pill status="Pending Check" />
                  <button onClick={() => markSiteVisitStockAvailable(v.id)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20 transition-colors whitespace-nowrap">Mark Available</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab !== 'Pending Site Stock Check' && (
        <>
          {filtered.length === 0 ? (
            <EmptyState title="No requests" message="No project stock requests match this view." />
          ) : (
            <div className="space-y-6 flex flex-col drop-shadow-xs">
              {paginatedFiltered.map((proj) => {
                const canReserve = !proj.items.some((r: any) => {
                  if (r.status !== 'Requested') return false
                  const item = r.stockItemId ? stockItems.find((s) => s.id === r.stockItemId) : undefined
                  return item ? item.availableQuantity < r.requestedQuantity : false
                })

                return (
                <details key={proj.projectId} className="group border border-border rounded-xl bg-black/[0.02] overflow-hidden" open>
                  <summary className="p-5 bg-white hover:bg-black/[0.01] cursor-pointer list-none flex flex-wrap gap-4 justify-between items-center transition-colors">
                    <div className="font-medium text-base text-text">
                      {proj.projectCode} — {proj.customerName}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-text-dim">{proj.items.length} requested products</div>
                      <Pill status={proj.overallStatus} />
                    </div>
                  </summary>
                  <div className="border-t border-border bg-white divide-y divide-border">
                    {proj.items.map((r: any) => {
                      const item = r.stockItemId ? stockItems.find((s) => s.id === r.stockItemId) : undefined
                      const qty = r.requestedQuantity
                      const insufficientToReserve = item ? item.availableQuantity < qty : false
                      
                      return (
                        <div key={r.reservationId} className="p-4 flex items-center justify-between hover:bg-black/[0.01] transition-colors">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-medium text-sm text-text truncate">{r.productName}</div>
                            <div className="text-xs text-text-dim flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                              <span>Needs: <span className="font-medium text-text">{qty} {r.unit}</span></span>
                              {item && (
                                <span>Master: <span className="font-medium text-text">{item.availableQuantity} {item.unit}</span> available</span>
                              )}
                              <span>Requested: {formatDate(r.createdAt)}</span>
                            </div>
                            {r.notes && <div className="text-xs text-text-dim mt-1 italic">{r.notes}</div>}
                            {insufficientToReserve && r.status === 'Requested' && (
                              <div className="text-xs text-rose font-medium mt-1.5">Insufficient stock — cannot fulfill this requirement.</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Pill status={r.status} />
                            {r.status === 'Reserved' && (
                              <button onClick={() => issueStockRequest(r.reservationId, employee?.name)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-sun/10 text-sun border border-sun/30 hover:bg-sun/20 transition-colors whitespace-nowrap">Mark Issued</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {proj.overallStatus === 'Requested' && (
                      <div className="p-3 bg-black/[0.02] flex justify-end">
                        <button 
                          onClick={(e) => { e.preventDefault(); if (canReserve) reserveProjectStockRequest(proj.projectId); }}
                          disabled={!canReserve}
                          className={`text-xs font-medium px-4 py-2 rounded-lg border whitespace-nowrap transition-colors ${canReserve ? 'bg-teal text-white border-teal hover:bg-teal/90' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
                        >
                          Reserve All Products
                        </button>
                      </div>
                    )}
                  </div>
                </details>
                )
              })}
              <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
            </div>
          )}
        </>
      )}

      <Card className="p-3 text-[11px] text-text-dim">
        Reserving moves quantity from Available to Reserved in the Product Master; issuing moves it from Reserved to Issued and reduces on-hand stock. Both actions update the linked project's warehouse status and are visible instantly on the Project Head's Stock Requests screen.
      </Card>
    </div>
  )
}
