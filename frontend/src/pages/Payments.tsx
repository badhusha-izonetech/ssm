import { useMemo, useState } from 'react'
import { useApp } from '../store/AppStore'
import { Card, SectionHeading, Pill, KpiCard } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import type { Payment } from '../types/models'
import { formatINR, formatDate } from '../lib/utils'

const STATE_OPTIONS = ['All States', 'Pending', 'Partial', 'Proof Uploaded', 'Under Verification', 'Verified', 'Rejected']

export default function Payments() {
  const { payments } = useApp()
  const [state, setState] = useState('All States')
  const [currentPage, setCurrentPage] = useState(1)
  const filtered = useMemo(() => payments.filter((p) => state === 'All States' || p.state === state), [payments, state])
  const paginatedList = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  const totalExpected = payments.reduce((s, p) => s + p.expectedAmount, 0)
  const totalReceived = payments.reduce((s, p) => s + p.actualAmount, 0)
  const pendingVerification = payments.filter((p) => p.state === 'Under Verification' || p.state === 'Proof Uploaded').length

  const columns: Column<Payment>[] = [
    { header: 'Customer', cell: (p) => p.customerName },
    { header: 'Type', cell: (p) => <span className="text-slate-500 font-medium">{p.paymentType}</span> },
    { header: 'Expected', cell: (p) => <span className="font-semibold text-slate-900">{formatINR(p.expectedAmount)}</span> },
    { header: 'Received', cell: (p) => (
      <span className={p.actualAmount < p.expectedAmount ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>{formatINR(p.actualAmount)}</span>
    ) },
    { header: 'Mode', cell: (p) => <span className="text-slate-600 font-medium">{p.paymentMode}</span> },
    { header: 'Reference', cell: (p) => <span className="font-mono text-[11px] text-slate-500">{p.transactionReference}</span> },
    { header: 'Date', cell: (p) => <span className="text-slate-500">{formatDate(p.paymentDate)}</span> },
    { header: 'State', cell: (p) => <Pill status={p.state} /> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Accounts" title="Payments" action={<span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/60">{filtered.length} of {payments.length}</span>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Total Expected" value={formatINR(totalExpected)} accent="teal" />
        <KpiCard label="Total Received" value={formatINR(totalReceived)} accent="sun" />
        <KpiCard label="Awaiting Verification" value={String(pendingVerification)} accent="amber" />
      </div>

      <Card className="p-4 flex flex-wrap gap-3 bg-white border border-[#e2e8e5] rounded-2xl shadow-xs">
        <select value={state} onChange={(e) => setState(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
          {STATE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Card>

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedList}
          keyFn={(p) => p.id}
          mobileCard={(p) => (
            <Card className="p-5 space-y-2.5">
              <div className="flex justify-between items-start gap-2">
                <div className="font-bold text-slate-900 text-sm">{p.customerName}</div>
                <Pill status={p.state} />
              </div>
              <div className="text-xs text-slate-600 font-medium">{p.paymentType} · {p.paymentMode}</div>
              <div className="flex justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-500">Expected <strong className="text-slate-800">{formatINR(p.expectedAmount)}</strong></span>
                <span className={p.actualAmount < p.expectedAmount ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>Received {formatINR(p.actualAmount)}</span>
              </div>
            </Card>
          )}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  )
}
