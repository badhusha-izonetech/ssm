import { useState, useEffect, useMemo } from 'react'
import { ReceiptText, RefreshCw } from 'lucide-react'
import { Card, EmptyState, SectionHeading, Pill } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import { formatINR } from '../lib/utils'
import { rangeFor } from '../lib/revenue'
import { gstApi, type GSTSummary, type InvoiceGSTEntry, type GSTPeriod } from '../api/gst'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const FILTERS = ['Today', 'Yesterday', 'This Week', 'This Month', 'This Year', 'Custom Date Range']

export default function GST() {
  const [filter, setFilter] = useState('This Month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const range = useMemo(() => rangeFor(filter, customFrom, customTo), [filter, customFrom, customTo])

  const [summary, setSummary] = useState<GSTSummary[]>([])
  const [register, setRegister] = useState<InvoiceGSTEntry[]>([])
  const [periods, setPeriods] = useState<GSTPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [registerPage, setRegisterPage] = useState(1)
  const [summaryPage, setSummaryPage] = useState(1)
  
  const paginatedRegister = useMemo(() => register.slice((registerPage - 1) * 25, registerPage * 25), [register, registerPage])
  const paginatedSummary = useMemo(() => summary.slice((summaryPage - 1) * 25, summaryPage * 25), [summary, summaryPage])

  useEffect(() => {
    fetchData()
  }, [filter, customFrom, customTo, range.from, range.to])

  const fetchData = async () => {
    if (filter === 'Custom Date Range' && (!customFrom || !customTo)) return
    setLoading(true)
    try {
      const [sumRes, regRes, perRes] = await Promise.all([
        gstApi.getSummary(),
        gstApi.getRegister('custom', range.from, range.to),
        gstApi.getPeriods()
      ])
      setSummary(sumRes)
      setRegister(regRes)
      setPeriods(perRes)
      setRegisterPage(1)
      setSummaryPage(1)
    } catch (err) {
      console.error('Failed to fetch GST data', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = async (periodMonth: string) => {
    try {
      await gstApi.markPaid(periodMonth)
      await fetchData()
    } catch (err) {
      console.error('Failed to mark paid', err)
    }
  }

  const handleExportPDF = () => {
    const doc = new jsPDF()
    const label = filter === 'Custom Date Range'
      ? range.from && range.to ? `${range.from} to ${range.to}` : 'Custom range'
      : range.label
    doc.text(`GST Report - ${label}`, 14, 15)

    doc.setFontSize(11)
    doc.text('GST Summary', 14, 25)
    autoTable(doc, {
      startY: 30,
      head: [['Period', 'Date Range', 'Invoices', 'Invoice Total', 'Taxable Amount', 'GST Payable']],
      body: summary.map(s => [
        s.label, 
        `${s.period_start} to ${s.period_end}`, 
        s.total_invoices.toString(), 
        s.invoice_total.toFixed(2), 
        s.taxable_amount.toFixed(2), 
        s.gst_payable.toFixed(2)
      ])
    })

    const finalY = (doc as any).lastAutoTable.finalY || 30
    doc.text(`Invoice Register (${label})`, 14, finalY + 15)
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Invoice No.', 'Customer', 'Date', 'Inv Amount', 'Taxable', 'GST %', 'GST Amount']],
      body: register.map(r => [
        r.invoice_number,
        r.customer_name,
        r.issue_date,
        r.grand_total.toFixed(2),
        r.taxable_amount.toFixed(2),
        `${r.gst_percent.toFixed(2)}%`,
        r.gst_amount.toFixed(2)
      ])
    })

    doc.save(`gst-report.pdf`)
  }

  const summaryColumns: Column<GSTSummary>[] = [
    { header: 'Period', cell: (item) => item.label },
    { header: 'Date Range', cell: (item) => `${item.period_start} to ${item.period_end}` },
    { header: 'Invoices Generated', cell: (item) => item.total_invoices },
    { header: 'Invoice Total', cell: (item) => formatINR(item.invoice_total) },
    { header: 'Taxable Amount', cell: (item) => formatINR(item.taxable_amount) },
    { header: 'GST Payable', cell: (item) => <span className="font-medium text-sun">{formatINR(item.gst_payable)}</span> },
  ]

  const registerColumns: Column<InvoiceGSTEntry>[] = [
    { header: 'Invoice No.', cell: (item) => <span className="font-mono text-xs text-teal">{item.invoice_number}</span> },
    { header: 'Customer', cell: (item) => <div className="font-medium">{item.customer_name}</div> },
    { header: 'Issue Date', cell: (item) => item.issue_date },
    { header: 'Invoice Amount', cell: (item) => formatINR(item.grand_total) },
    { header: 'Taxable Amount', cell: (item) => formatINR(item.taxable_amount) },
    { header: 'GST %', cell: (item) => `${item.gst_percent.toFixed(2)}%` },
    { header: 'GST Amount', cell: (item) => <span className="font-bold text-emerald-700">{formatINR(item.gst_amount)}</span> },
  ]
  
  const periodColumns: Column<GSTPeriod>[] = [
    { header: 'Period Month', cell: (item) => item.period_month },
    { header: 'Total Invoices', cell: (item) => item.total_invoices },
    { header: 'Taxable Amount', cell: (item) => formatINR(item.taxable_amount) },
    { header: 'GST Payable', cell: (item) => <span className="font-bold text-emerald-700">{formatINR(item.gst_payable)}</span> },
    { header: 'Status', cell: (item) => <Pill status={item.is_paid ? 'Verified' : 'Pending'} /> },
    { header: 'Action', cell: (item) => !item.is_paid ? <button onClick={() => handleMarkPaid(item.period_month)} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer">Mark Paid</button> : <span className="text-xs text-slate-400">Paid on {item.paid_date ? new Date(item.paid_date).toLocaleDateString() : ''}</span> },
  ]

  if (loading) return <div className="p-12 text-center text-sm text-slate-500 font-medium">Loading GST Data...</div>

  const label = filter === 'Custom Date Range'
    ? range.from && range.to ? `${range.from} to ${range.to}` : 'Custom range'
    : range.label

  return (
    <div className="space-y-5">
      <SectionHeading 
        eyebrow="CEO → Finance" 
        title="GST Payable" 
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Period:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold outline-none text-slate-800 pr-2 cursor-pointer"
              >
                {FILTERS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              {filter === 'Custom Date Range' && (
                <div className="flex items-center gap-1.5 ml-1 border-l border-slate-200 pl-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none"
                  />
                </div>
              )}
            </div>
            <button onClick={handleExportPDF} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
              Export Report (PDF)
            </button>
          </div>
        }
      />
      <Card className="p-4 flex gap-3.5 items-center bg-white border border-[#e2e8e5] rounded-2xl shadow-xs">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
          <ReceiptText size={18} />
        </div>
        <span className="text-xs text-slate-600 font-medium flex-1">
          GST is automatically calculated based on the Invoice Generation Date. Review weekly, monthly, or yearly summaries.
        </span>
        {loading && <RefreshCw size={14} className="text-slate-400 animate-spin" />}
      </Card>

      <Card className="p-4">
        <SectionHeading eyebrow="GST Summary" title="Summary by Period" />
        {summary.length ? (
          <div className="flex flex-col drop-shadow-xs mt-3">
            <DataTable columns={summaryColumns} rows={paginatedSummary} keyFn={(item) => item.label} mobileCard={() => <Card><div/></Card>} />
            <Pagination currentPage={summaryPage} totalItems={summary.length} onPageChange={setSummaryPage} />
          </div>
        ) : (
          <EmptyState title="No GST summaries" message="Generate invoices to see summaries." />
        )}
      </Card>
      
      <Card className="p-4">
        <SectionHeading eyebrow={`Register (${label})`} title="Invoice GST Register" />
        {register.length ? (
          <div className="flex flex-col drop-shadow-xs mt-3">
            <DataTable columns={registerColumns} rows={paginatedRegister} keyFn={(item) => item.id} mobileCard={() => <Card><div/></Card>} />
            <Pagination currentPage={registerPage} totalItems={register.length} onPageChange={setRegisterPage} />
          </div>
        ) : (
          <EmptyState title="No invoices found" message={`No invoices generated for ${label}.`} />
        )}
      </Card>
      
      <Card className="p-4">
        <SectionHeading eyebrow="Payment Tracking" title="Monthly GST Periods" />
        {periods.length ? (
          <DataTable columns={periodColumns} rows={periods} keyFn={(item) => item.id} mobileCard={() => <Card><div/></Card>} />
        ) : (
          <EmptyState title="No periods recorded" message="Once a month closes, or when you explicitly mark it, it will appear here." />
        )}
      </Card>

    </div>
  )
}
