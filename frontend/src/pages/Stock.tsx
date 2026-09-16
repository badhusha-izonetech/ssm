import { useMemo, useState } from 'react'
import { useApp } from '../store/AppStore'
import { Card, SectionHeading, KpiCard } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import type { StockItem } from '../types/models'
import { formatINR } from '../lib/utils'
import { AlertTriangle } from 'lucide-react'

export default function Stock() {
  const { stockItems } = useApp()
  const [category, setCategory] = useState('All Categories')
  const [currentPage, setCurrentPage] = useState(1)
  const CATEGORY_OPTIONS = useMemo(() => ['All Categories', ...Array.from(new Set(stockItems.map((s) => s.category)))], [stockItems])
  const filtered = useMemo(() => stockItems.filter((s) => category === 'All Categories' || s.category === category), [stockItems, category])
  const paginatedList = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  const totalValue = stockItems.reduce((s, i) => s + i.currentQuantity * i.costPerUnit, 0)
  const lowStockCount = stockItems.filter((s) => s.availableQuantity <= s.minimumLevel).length

  const columns: Column<StockItem>[] = [
    { header: 'Product', cell: (s) => (
      <div>
        <div className="font-medium text-text">{s.productName}</div>
        <div className="text-xs text-text-dim">{s.brand} · {s.model}</div>
      </div>
    ) },
    { header: 'Category', cell: (s) => s.category },
    { header: 'Current', cell: (s) => `${s.currentQuantity} ${s.unit}` },
    { header: 'Reserved', cell: (s) => <span className="text-amber-700 font-semibold">{s.reservedQuantity} {s.unit}</span> },
    { header: 'Available', cell: (s) => (
      <span className={s.availableQuantity <= s.minimumLevel ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
        {s.availableQuantity} {s.unit}
      </span>
    ) },
    { header: 'Min. Level', cell: (s) => <span className="text-slate-500 font-medium">{s.minimumLevel} {s.unit}</span> },
    { header: 'Value', cell: (s) => <span className="font-semibold text-slate-900">{formatINR(s.currentQuantity * s.costPerUnit)}</span> },
    { header: '', cell: (s) => s.availableQuantity <= s.minimumLevel && <AlertTriangle size={15} className="text-rose-600" /> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Warehouse" title="Stock" action={<span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/60">{filtered.length} of {stockItems.length} items</span>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Total Inventory Value" value={formatINR(totalValue)} accent="teal" />
        <KpiCard label="Items Below Minimum" value={String(lowStockCount)} accent="rose" />
        <KpiCard label="Categories Tracked" value={String(CATEGORY_OPTIONS.length - 1)} accent="sun" />
      </div>

      <Card className="p-4 flex flex-wrap gap-3 bg-white border border-[#e2e8e5] rounded-2xl shadow-xs">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
          {CATEGORY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Card>

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedList}
          keyFn={(s) => s.id}
          mobileCard={(s) => (
            <Card className="p-5 space-y-2.5">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{s.productName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.brand} · {s.model}</div>
                </div>
                {s.availableQuantity <= s.minimumLevel && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
              </div>
              <div className="flex gap-4 text-xs text-slate-600 font-medium pt-1 border-t border-slate-100">
                <span>Available: <span className={s.availableQuantity <= s.minimumLevel ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>{s.availableQuantity} {s.unit}</span></span>
                <span>Reserved: <span className="font-semibold text-slate-900">{s.reservedQuantity} {s.unit}</span></span>
              </div>
            </Card>
          )}
        />
        <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
      </div>
    </div>
  )
}
