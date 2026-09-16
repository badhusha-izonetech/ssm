import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, Avatar } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { ExistingCustomerLeadModal } from '../../components/shared/ExistingCustomerLeadModal'
import { formatINR, formatDate } from '../../lib/utils'

export default function CustomerList() {
  const { employee, portal } = useAuth()
  const { projects, leads, quotations } = useApp()
  const [enquiryFor, setEnquiryFor] = useState<any | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Existing Customers = customers whose project has fully reached Completed.
  const customers = useMemo(() => {
    const completedProjects = projects.filter(p => p.status === 'Completed')
    return completedProjects.map(p => {
      const q = quotations.find(q => q.id === p.quotationId)
      const lead = leads.find(l => l.id === q?.leadId)

      return {
        id: p.id,
        customerId: lead?.id || p.id,
        customerName: p.customerName,
        mobile: p.customerMobile || lead?.mobile || '',
        area: p.area || lead?.area || '',
        completedProjectCode: p.projectCode,
        completedProjectId: p.id,
        capacityKw: p.capacityKw || 0,
        totalValue: p.projectValue || 0,
        completedOn: p.dueDate || new Date().toISOString()
      }
    })
  }, [projects, leads, quotations])

  const paginatedCustomers = useMemo(() => customers.slice((currentPage - 1) * 25, currentPage * 25), [customers, currentPage])

  const columns: Column<any>[] = [
    { header: 'Customer', cell: (c) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={c.customerName} color="#0f9d68" />
        <div>
          <div className="font-medium text-text">{c.customerName}</div>
          <div className="text-xs text-text-dim">{c.mobile}</div>
        </div>
      </div>
    ) },
    { header: 'Area', cell: (c) => c.area },
    { header: 'Completed Project', cell: (c) => <span className="font-mono text-xs text-teal">{c.completedProjectCode}</span> },
    { header: 'Capacity', cell: (c) => `${c.capacityKw} kW` },
    { header: 'Value', cell: (c) => formatINR(c.totalValue) },
    { header: 'Completed On', cell: (c) => <span className="text-text-dim">{formatDate(c.completedOn)}</span> },
    { header: 'Status', cell: () => <Pill status="Completed" /> },
    { header: '', cell: (c) => (
      <button onClick={(e) => { e.stopPropagation(); setEnquiryFor(c) }} className="text-xs text-sun hover:underline whitespace-nowrap">
        + New Enquiry
      </button>
    ) },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow={portal === 'Telecalling' ? 'Telecalling' : 'Direct / Field Marketing'}
        title="Existing Customers"
        action={<span className="text-xs text-text-dim">{customers.length} completed customers</span>}
      />
      <p className="text-xs text-text-dim -mt-3">
        Only customers with a fully completed project appear here. Start a "New Enquiry" if one of them wants another project — it opens a fresh lead in your inbox.
      </p>

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedCustomers}
          keyFn={(c) => c.completedProjectId}
          mobileCard={(c) => (
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={c.customerName} color="#0f9d68" />
                <div>
                  <div className="font-medium">{c.customerName}</div>
                  <div className="text-xs text-text-dim">{c.mobile} · {c.area}</div>
                </div>
              </div>
              <div className="text-xs text-text-dim">{c.completedProjectCode} · {c.capacityKw} kW</div>
              <button onClick={() => setEnquiryFor(c)} className="text-xs text-sun hover:underline">+ New Enquiry</button>
            </Card>
          )}
        />
        <Pagination currentPage={currentPage} totalItems={customers.length} onPageChange={setCurrentPage} />
      </div>

      {enquiryFor && employee && (
        <ExistingCustomerLeadModal
          customer={enquiryFor}
          assignedEmployeeId={employee.id}
          onClose={() => setEnquiryFor(null)}
        />
      )}
    </div>
  )
}
