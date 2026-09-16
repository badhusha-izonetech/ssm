import type { ReactNode } from 'react'

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  keyFn: (row: T) => string
  onRowClick?: (row: T) => void
  mobileCard: (row: T) => ReactNode
}

export function DataTable<T>({ columns, rows, keyFn, onRowClick, mobileCard }: DataTableProps<T>) {
  return (
    <>
      <div className="hidden md:block overflow-auto max-h-[calc(100vh-240px)] rounded-t-2xl border border-[#e2e8e5] border-b-0 bg-white">
        <table className="w-full text-sm border-collapse relative">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm backdrop-blur-sm">
            <tr className="border-b border-[#e2e8e5] text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              {columns.map((c) => (
                <th key={c.header} className={`text-left px-5 py-3.5 whitespace-nowrap bg-slate-50 ${c.className ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8e5]">
            {rows.map((row) => (
              <tr
                key={keyFn(row)}
                onClick={() => onRowClick?.(row)}
                className={`bg-white transition-colors duration-150 ${
                  onRowClick ? 'cursor-pointer hover:bg-emerald-50/30' : 'hover:bg-slate-50/50'
                }`}
              >
                {columns.map((c) => (
                  <td key={c.header} className={`px-5 py-3.5 align-middle text-slate-800 ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm font-medium">No records match the current filters.</div>
        )}
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={keyFn(row)} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer' : ''}>
            {mobileCard(row)}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm font-medium bg-white rounded-2xl border border-[#e2e8e5] p-6">
            No records match the current filters.
          </div>
        )}
      </div>
    </>
  )
}
