import React, { useState } from 'react'
import { useApp } from '../../store/AppStore'
import { SectionHeading, Card, Pill } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { SiteVisitDetail } from '../../components/sitevisit/SiteVisitDetail'
import { formatDate } from '../../lib/utils'
import type { SiteVisit } from '../../types/models'
import { MapPin, Search } from 'lucide-react'

export default function SiteProducts() {
  const { marketingSiteProducts } = useApp()
  const [search, setSearch] = useState('')
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null)

  const visible = (marketingSiteProducts || []).filter(v =>
    (v.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.customerMobile && v.customerMobile.includes(search))
  )

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedVisible = React.useMemo(() => visible.slice((currentPage - 1) * 25, currentPage * 25), [visible, currentPage])

  const columns: Column<SiteVisit>[] = [
    {
      header: 'Customer', cell: (v) => (
        <div>
          <div className="font-medium text-text">{v.customerName}</div>
          <div className="text-xs text-text-dim">{v.customerMobile || '-'}</div>
        </div>
      )
    },
    { header: 'Completed On', cell: (v) => <span className="text-text-dim">{v.completedOn ? formatDate(v.completedOn) : '-'}</span> },
    {
      header: 'Site', cell: (v) => (
        <div className="flex items-start gap-1">
          <MapPin size={12} className="text-text-dim mt-0.5" />
          <span className="text-text-dim line-clamp-2 max-w-[200px]">{v.siteType || 'Unknown'}</span>
        </div>
      )
    },
    {
      header: 'Products Captured', cell: (v) => (
        <div className="text-xs text-text-dim max-w-[250px] line-clamp-2">
          {v.rawMaterialDetails && v.rawMaterialDetails.length > 0
            ? v.rawMaterialDetails.map(rm => `${rm.itemName} (x${rm.quantity})`).join(', ')
            : 'No products selected'}
        </div>
      )
    },
    { header: 'Feasibility', cell: (v) => <Pill status={v.feasibilityResult || v.status} /> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Marketing → Site Products"
        title="Completed Site Products"
      />

      <Card className="p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-panel border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-dim outline-none focus:border-sun transition-colors"
          />
        </div>
        <div className="text-xs text-text-dim ml-auto">
          {visible.length} site product{visible.length === 1 ? '' : 's'} found
        </div>
      </Card>

      {!marketingSiteProducts || marketingSiteProducts.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-panel rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl">📦</span>
          </div>
          <div className="text-text font-medium">No completed site visits available.</div>
          <div className="text-text-dim text-sm mt-1 max-w-sm">
            When a site visitor completes a site visit assigned to you, the captured products and site details will appear here.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col drop-shadow-xs">
          <DataTable
            columns={columns}
            rows={paginatedVisible}
            keyFn={(v) => v.id}
            onRowClick={(v) => setSelectedVisit(v)}
            mobileCard={(v) => (
              <Card className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{v.customerName}</div>
                    <div className="text-xs text-text-dim">{v.customerMobile}</div>
                  </div>
                  <Pill status={v.feasibilityResult || v.status} />
                </div>
                <div className="text-xs text-text-dim">
                  <div className="font-medium text-text mb-1">Products:</div>
                  {v.rawMaterialDetails && v.rawMaterialDetails.length > 0
                    ? v.rawMaterialDetails.map(rm => `${rm.itemName} (x${rm.quantity})`).join(', ')
                    : 'No products selected'}
                </div>
              </Card>
            )}
          />
          <Pagination currentPage={currentPage} totalItems={visible.length} onPageChange={setCurrentPage} />
        </div>
      )}

      {selectedVisit && (
        <SiteVisitDetail
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
        />
      )}
    </div>
  )
}
