import { useMemo, useState, useEffect } from 'react'
import { Card, SectionHeading } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import { ExistingCustomerLeadModal } from '../components/shared/ExistingCustomerLeadModal'
import { useAuth } from '../auth/AuthContext'
import { customersApi } from '../api/customers'
import { Pill } from '../components/shared/Primitives'
import type { GlobalCustomerView } from '../types/models'

export default function Customers() {
  const { employee, employees } = useAuth()
  const [query, setQuery] = useState('')
  const [enquiryFor, setEnquiryFor] = useState<GlobalCustomerView | null>(null)
  const [apiCustomers, setApiCustomers] = useState<GlobalCustomerView[]>([])
  const [tab, setTab] = useState<'All' | 'Current' | 'Finished'>('All')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    customersApi.getAll().then(setApiCustomers).catch(console.error)
  }, [])

  const customers = useMemo(
    () => apiCustomers.filter((c) => {
      const matchesQuery = c.customerName?.toLowerCase().includes(query.toLowerCase())
      if (!matchesQuery) return false
      
      if (tab === 'Current') return c.projectStage !== 'Completed' && c.leadStatus !== 'Lost'
      if (tab === 'Finished') return c.projectStage === 'Completed'
      return true
    }),
    [apiCustomers, query, tab],
  )
  const paginatedList = useMemo(() => customers.slice((currentPage - 1) * 25, currentPage * 25), [customers, currentPage])

  const columns: Column<GlobalCustomerView>[] = [
    { header: 'Customer', cell: (c) => (
      <div>
        <div className="font-medium text-text">{c.customerName}</div>
        <div className="text-xs text-text-dim">{c.mobile}</div>
      </div>
    ) },
    { header: 'Location', cell: (c) => (
      <div className="text-xs">
        <div>{c.area || '—'}, {c.city || '—'}</div>
        <div className="text-text-dim max-w-[200px] truncate">{c.address || ''}</div>
      </div>
    ) },
    { header: 'Lead Status', cell: (c) => <Pill status={c.leadStatus} /> },
    { header: 'Project Stage', cell: (c) => (
      <div className="text-xs">
        {c.projectStage ? <Pill status={c.projectStage} /> : <span className="text-text-dim">—</span>}
        {c.projectCode && <div className="text-[10px] text-text-dim mt-0.5">{c.projectCode}</div>}
      </div>
    ) },
    { header: 'Assigned To', cell: (c) => c.assignedEmployeeName || '—' },
    { header: 'Lead Info', cell: (c) => (
      <div className="text-[10px] text-text-dim leading-tight">
        <div>{c.customerType}</div>
        <div>{c.productInterested || '—'}</div>
        {c.paymentType && <div className="text-teal font-medium mt-0.5">{c.paymentType}</div>}
      </div>
    ) },
    { header: '', cell: (c) => (
      <button
        onClick={(e) => { e.stopPropagation(); setEnquiryFor(c) }}
        className="text-xs text-sun hover:underline whitespace-nowrap"
      >
        + New Enquiry
      </button>
    ) },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Global View"
        title="Existing Customers"
        action={<span className="text-xs text-text-dim">{customers.length} total customers</span>}
      />
      <p className="text-xs text-text-dim -mt-3">
        This list automatically includes all customers who have been assigned or are currently in a workflow.
      </p>
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers…"
          className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 w-full max-w-sm placeholder:text-slate-400"
        />
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setTab('All')}
            className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${tab === 'All' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All
          </button>
          <button
            onClick={() => setTab('Current')}
            className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${tab === 'Current' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Current
          </button>
          <button
            onClick={() => setTab('Finished')}
            className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${tab === 'Finished' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Finished
          </button>
        </div>
      </Card>
      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedList}
          keyFn={(c) => c.id}
          mobileCard={(c) => (
            <Card className="p-5 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{c.customerName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.mobile} · {c.area}</div>
                </div>
                <Pill status={c.leadStatus} />
              </div>
              
              <div className="text-xs text-slate-600 border-t border-slate-100 pt-2.5 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Assigned:</span>
                  <span className="font-semibold text-slate-900">{c.assignedEmployeeName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Project Stage:</span>
                  <span className="font-semibold text-slate-900">{c.projectStage || '—'} {c.projectCode ? `(${c.projectCode})` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Payment:</span>
                  <span className="text-emerald-700 font-bold">{c.paymentType || '—'}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <button onClick={() => setEnquiryFor(c)} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">+ New Enquiry</button>
              </div>
            </Card>
          )}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={customers.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {enquiryFor && employee && (
        <ExistingCustomerLeadModal
          customer={{
             customerName: enquiryFor.customerName,
             mobile: enquiryFor.mobile,
             area: enquiryFor.area || '',
             customerId: enquiryFor.id,
          } as any}
          assignedEmployeeId={employee.id}
          onClose={() => setEnquiryFor(null)}
        />
      )}

      <Card className="p-4 text-xs text-text-dim">
        Marketing employees for reassignment reference: {employees.filter((e) => e.department === 'Marketing').map((e) => e.name).join(', ')}
      </Card>
    </div>
  )
}
