import { useState, useEffect, useCallback } from 'react'
import { Download, Loader2, Eye, Search } from 'lucide-react'
import { Card, SectionHeading, Pill, Modal, inputCls } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { quotationsApi } from '../../api/quotations'
import type { Quotation } from '../../types/models'
import { formatINR, formatDate } from '../../lib/utils'
import { downloadQuotationPDF } from '../../lib/quotationDoc'

const STATUS_OPTIONS = ['All', 'Sent', 'Customer Review', 'Revision Required', 'Customer Approved', 'Customer Rejected']

function ViewQuotationModal({ quotation, onClose }: { quotation: Quotation, onClose: () => void }) {
  return (
    <Modal title={`Quotation Details — ${quotation.quotationNumber}`} onClose={onClose} wide>
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Customer</div>
            <div className="text-sm font-semibold text-slate-900">{quotation.customerName}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Phone</div>
            <div className="text-sm text-slate-900">{quotation.customerPhone || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Date</div>
            <div className="text-sm text-slate-900">{formatDate(quotation.date)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Status</div>
            <div className="mt-1"><Pill status={quotation.status} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Site / Address</div>
            <div className="text-sm text-slate-900">{quotation.site}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Prepared By</div>
            <div className="text-sm text-slate-900">{quotation.preparedBy}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Project Type</div>
            <div className="text-sm font-medium">{quotation.projectType || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Solar Panel</div>
            <div className="text-sm font-medium">{quotation.solarPanel || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Solar Inverter</div>
            <div className="text-sm font-medium">{quotation.solarInverter || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Valid Until</div>
            <div className="text-sm font-medium">{quotation.validUntil ? formatDate(quotation.validUntil) : '-'}</div>
          </div>
        </div>

        <div>
          <h4 className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3 border-b border-slate-100 pb-2">Line Items</h4>
          <div className="space-y-3">
            {quotation.lineItems?.map((it, idx) => (
              <div key={it.id || idx} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{it.product}</div>
                    {it.description && <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{it.description}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-emerald-700">{formatINR((it as any).lineTotal || (it.quantity * it.unitPrice))}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{it.quantity} {it.unit} @ {formatINR(it.unitPrice)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] uppercase font-bold text-slate-500">Grand Total</div>
            <div className="font-bold text-xl text-slate-900 mt-1">{formatINR(quotation.grandTotal)}</div>
          </div>
          <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] uppercase font-bold text-slate-500">Advance ({quotation.advancePercentage}%)</div>
            <div className="font-bold text-xl text-emerald-700 mt-1">{formatINR(quotation.advanceAmount)}</div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button onClick={onClose} className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

function QuotationDashboardActions({ q, onView, onUpdateStatus }: { q: Quotation, onView: (q: Quotation) => void, onUpdateStatus: (id: string, status: string, reason?: string) => void }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (downloading) return
    setDownloading(true)
    try {
      await downloadQuotationPDF(q)
    } catch (err) {
      console.error('Failed to download PDF:', err)
      alert('Failed to download PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const handleSendToCustomer = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!q.customerPhone) {
      e.preventDefault()
      alert("Customer WhatsApp number is not available.")
      return
    }

    let phone = String(q.customerPhone).replace(/[\s\-\(\)]/g, '')
    if (phone.startsWith('+')) {
      phone = phone.slice(1)
    }
    if (phone.length === 10) {
      phone = '91' + phone
    }

    if (!/^\d{12}$/.test(phone)) {
      e.preventDefault()
      alert("Invalid customer WhatsApp number.")
      return
    }
  }

  let phoneStr = q.customerPhone ? String(q.customerPhone).replace(/[\s\-\(\)]/g, '') : ''
  if (phoneStr.startsWith('+')) phoneStr = phoneStr.slice(1)
  if (phoneStr.length === 10) phoneStr = '91' + phoneStr

  const waMessage = encodeURIComponent(`Hello ${q.customerName},\n\nPlease find your quotation ${q.quotationNumber} from Success Solar Power Care.\n\nThank you.`)
  const waUrl = `https://wa.me/${phoneStr}?text=${waMessage}`

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => onView(q)}
        className="p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
        title="View Details"
      >
        <Eye size={16} />
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
        title="Download PDF"
      >
        {downloading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <Download size={16} />}
      </button>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleSendToCustomer}
        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline ml-2"
      >
        Send to WA
      </a>
      {q.status === 'Sent' && (
        <button onClick={(e) => { e.stopPropagation(); onUpdateStatus(q.id, 'Customer Review') }} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline ml-2">Mark Customer Review</button>
      )}
      {q.status === 'Customer Review' && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onUpdateStatus(q.id, 'Customer Approved') }} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline ml-2">Approve</button>
          <button onClick={(e) => {
            e.stopPropagation();
            const reason = window.prompt("Enter rejection reason:");
            if (reason !== null) {
              onUpdateStatus(q.id, 'Customer Rejected', reason);
            }
          }} className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline ml-2">Reject</button>
        </>
      )}
    </div>
  )
}

export default function QuotationDashboard() {
  const [data, setData] = useState<Quotation[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await quotationsApi.getDashboard({
        search,
        status: status === 'All' ? undefined : status,
        fromDate,
        toDate,
        page,
        limit: 50
      })
      const filteredItems = (res.items || []).filter((q: Quotation) => !['Quotation Created', 'Submitted'].includes(q.status))
      setData(filteredItems)
      setSummary(res.summary)
      setTotalPages(res.pages || 1)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [search, status, fromDate, toDate, page])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchDashboardData()
  }

  const handleUpdateStatus = async (id: string, status: string, _reason?: string) => {
    try {
      await quotationsApi.updateStatus(id, status)
      // Reason is currently not tracked in the backend for Customer Rejected, but we prompt for it anyway to match old UI flow
      fetchDashboardData()
    } catch (err) {
      console.error('Failed to update status:', err)
      alert('Failed to update status.')
    }
  }

  const columns: Column<Quotation>[] = [
    { header: 'Quotation #', cell: (q) => <span className="font-mono text-xs text-teal">{q.quotationNumber}</span> },
    {
      header: 'Customer', cell: (q) => (
        <div>
          <div className="font-medium text-sm text-slate-900">{q.customerName}</div>
          <div className="text-[11px] text-slate-500">{q.customerPhone || q.site}</div>
        </div>
      )
    },
    { header: 'Grand Total', cell: (q) => <span className="font-medium">{formatINR(q.grandTotal)}</span> },
    { header: 'Prepared By', cell: (q) => <span className="text-xs text-slate-600">{q.preparedBy}</span> },
    { header: 'Date', cell: (q) => <span className="text-xs text-slate-600">{formatDate(q.date)}</span> },
    { header: 'Status', cell: (q) => <Pill status={q.status} label={q.status} /> },
    { header: '', cell: (q) => <QuotationDashboardActions q={q} onView={setViewingQuotation} onUpdateStatus={handleUpdateStatus} /> },
  ]

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Quotation Portal"
        title="Quotation Dashboard"
      />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4 bg-white border-l-4 border-l-slate-400">
            <div className="text-[11px] uppercase font-bold text-slate-500">Total</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</div>
          </Card>
          <Card className="p-4 bg-white border-l-4 border-l-yellow-400">
            <div className="text-[11px] uppercase font-bold text-slate-500">Draft</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.draft}</div>
          </Card>
          <Card className="p-4 bg-white border-l-4 border-l-blue-400">
            <div className="text-[11px] uppercase font-bold text-slate-500">Sent</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary.sent}</div>
          </Card>
          <Card className="p-4 bg-white border-l-4 border-l-emerald-500">
            <div className="text-[11px] uppercase font-bold text-slate-500">Approved</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.customerApproved}</div>
          </Card>
          <Card className="p-4 bg-white border-l-4 border-l-rose-500">
            <div className="text-[11px] uppercase font-bold text-slate-500">Rejected</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{summary.customerRejected}</div>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Name, Phone, Quotation #"
                className={`${inputCls} pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Status</label>
            <select
              className={inputCls}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="w-36">
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              className={inputCls}
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-36">
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              className={inputCls}
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            />
          </div>
          <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors h-[38px]">
            Apply Filters
          </button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {loading && data.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="animate-spin mb-2" size={24} />
            <div className="text-sm">Loading quotations...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No quotations found matching your criteria.</div>
        ) : (
          <div className="flex flex-col drop-shadow-xs">
            <DataTable
              columns={columns}
              rows={data}
              keyFn={(q) => q.id}
              mobileCard={(q) => (
                <Card className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{q.customerName}</div>
                      <div className="font-mono text-[11px] text-emerald-700 font-semibold">{q.quotationNumber}</div>
                    </div>
                    <Pill status={q.status} />
                  </div>
                  <div className="text-xs text-slate-600 font-medium">{formatINR(q.grandTotal)}</div>
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                    <QuotationDashboardActions q={q} onView={setViewingQuotation} onUpdateStatus={handleUpdateStatus} />
                  </div>
                </Card>
              )}
            />
            <Pagination currentPage={page} totalItems={totalPages * 50} itemsPerPage={50} onPageChange={setPage} />
          </div>
        )}


      </Card>

      {viewingQuotation && (
        <ViewQuotationModal
          quotation={viewingQuotation}
          onClose={() => setViewingQuotation(null)}
        />
      )}
    </div>
  )
}
