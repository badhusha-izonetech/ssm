import { useMemo, useState } from 'react'
import { Download, Edit, Trash2, Loader2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useMarketing } from '../store/MarketingStore'
import { Card, SectionHeading, Pill, Field, inputCls, Modal } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import { QuotationBuilder } from '../components/shared/QuotationBuilder'
import { ProductCatalogModal } from '../components/shared/ProductCatalogModal'
import type { Quotation } from '../types/models'
import { formatINR, formatDate } from '../lib/utils'
import { downloadQuotationPDF } from '../lib/quotationDoc'

const STATUS_OPTIONS = ['All Status', 'Quotation Created', 'Submitted', 'Sent', 'Customer Review', 'Revision Required', 'Customer Approved', 'Customer Rejected', 'Expired']

function QuotationActions({
  q,
  onEdit,
  onReject,
  onDelete,
}: {
  q: Quotation
  onEdit: (q: Quotation) => void
  onReject: (q: Quotation) => void
  onDelete: (q: Quotation) => void
}) {
  const { updateQuotationStatus } = useMarketing()
  const { portal } = useAuth()
  const [downloading, setDownloading] = useState(false)
  const canEdit = q.status !== 'Expired'

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (downloading) return
    setDownloading(true)
    try {
      await downloadQuotationPDF(q)
    } catch (err) {
      console.error('Failed to download quotation PDF:', err)
      alert('Failed to download quotation PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const handleSendToQM = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateQuotationStatus(q.id, 'Sent')
  }

  const handleSendToWA = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!q.customerPhone) {
      e.preventDefault()
      alert("Customer WhatsApp number is not available.\nPlease update the quotation Phone Number.")
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
      alert("Invalid customer WhatsApp number.\nPlease update the quotation Phone Number.")
      return
    }

    if (q.status === 'Submitted') {
      updateQuotationStatus(q.id, 'Sent')
    }
  }

  let phoneStr = q.customerPhone ? String(q.customerPhone).replace(/[\s\-\(\)]/g, '') : ''
  if (phoneStr.startsWith('+')) phoneStr = phoneStr.slice(1)
  if (phoneStr.length === 10) phoneStr = '91' + phoneStr

  const waMessage = encodeURIComponent(`Hello ${q.customerName},\n\nPlease find your quotation ${q.quotationNumber} from Success Solar Power Care.\n\nThank you.`)
  const waUrl = `https://wa.me/${phoneStr}?text=${waMessage}`

  const isUncreated = (q.status === 'Quotation Created' && q.grandTotal === 0) || !q.grandTotal

  if (isUncreated) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onEdit(q)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          Create New Quotation
        </button>
        <button
          onClick={() => onDelete(q)}
          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg p-1.5 transition-colors cursor-pointer"
          title="Delete quotation"
        >
          <Trash2 size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50 cursor-pointer"
        title="Download PDF"
      >
        {downloading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <Download size={16} />}
      </button>

      {canEdit && (
        <button onClick={() => onEdit(q)} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Edit">
          <Edit size={16} />
        </button>
      )}
      {q.status === 'Quotation Created' && (
        <button onClick={() => updateQuotationStatus(q.id, 'Submitted')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">Submit for Review</button>
      )}
      {q.status === 'Submitted' && portal !== 'Quotation Dashboard' && (
        <button onClick={handleSendToQM} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">Send To QM</button>
      )}
      {q.status === 'Submitted' && portal === 'Quotation Dashboard' && (
        <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={handleSendToWA} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">Send to WA</a>
      )}
      {q.status === 'Sent' && portal === 'Quotation Dashboard' && (
        <button onClick={() => updateQuotationStatus(q.id, 'Customer Review')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">Mark Customer Review</button>
      )}
      {q.status === 'Customer Review' && (
        <>
          <button onClick={() => updateQuotationStatus(q.id, 'Customer Approved')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">Customer Approved</button>
          <button onClick={() => onReject(q)} className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline">Customer Rejected</button>
        </>
      )}
      <button
        onClick={() => onDelete(q)}
        className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
        title="Delete quotation"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export default function Quotations() {
  const { portal } = useAuth()
  const { quotations, leads, siteVisits, marketingSiteProducts, updateQuotationStatus, deleteQuotation } = useMarketing()
  const [status, setStatus] = useState('All Status')
  const [showCatalog, setShowCatalog] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [rejecting, setRejecting] = useState<Quotation | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [deleting, setDeleting] = useState<Quotation | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Deduplicate by quotationNumber to show the latest revision per quotation number,
  // preventing separated multiple rows for the same quotation.
  const visible = useMemo(() => {
    if (status === 'Expired') return quotations.filter((q) => q.status === 'Expired')

    const pendingQuotations = leads
      .filter(l => 
        l.status === 'Quotation Stage' || 
        siteVisits.some(v => v.leadId === l.id && v.status === 'Completed') ||
        marketingSiteProducts?.some(v => v.leadId === l.id && v.status === 'Completed')
      )
      .filter(l => !quotations.some(q => q.leadId === l.id))
      .map(l => ({
        id: `pending-${l.id}`,
        leadId: l.id,
        quotationNumber: `Pending`,
        customerName: l.customerName,
        customerPhone: l.mobile,
        site: l.address || l.city || '',
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date().toISOString().slice(0, 10),
        preparedBy: '',
        projectType: 'Residential Rooftop',
        grandTotal: 0,
        advancePercentage: 50,
        advanceAmount: 0,
        balanceAmount: 0,
        status: 'Quotation Created' as const,
        revisionNumber: 0,
      } as Quotation))

    const latestByNumber = new Map<string, Quotation>()
    for (const q of [...pendingQuotations, ...quotations]) {
      // Block uncreated quotations globally until warehouse marks stock Available
      if (q.status === 'Quotation Created' && (!q.grandTotal || q.grandTotal === 0)) {
        if (q.leadId) {
          const lVisits = [
            ...siteVisits.filter(v => v.leadId === q.leadId && v.status === 'Completed'),
            ...(marketingSiteProducts || []).filter(v => v.leadId === q.leadId && v.status === 'Completed')
          ]
          if (lVisits.length > 0) {
            const hasAvailable = lVisits.some(v => v.stockAvailabilityStatus === 'Available')
            if (!hasAvailable) continue // Hide from everyone until Warehouse clicks 'Mark Available'
          }
        }
      }

      const key = q.id.startsWith('pending-') ? q.id : q.quotationNumber
      const existing = latestByNumber.get(key)
      if (!existing || (q.revisionNumber ?? 0) >= (existing.revisionNumber ?? 0)) {
        latestByNumber.set(key, q)
      }
    }
    const list = Array.from(latestByNumber.values())
    
    let filteredList = list
    if (portal === 'Quotation Dashboard') {
      filteredList = list.filter((q) => !['Quotation Created', 'Submitted'].includes(q.status))
    }

    if (status === 'All Status') return filteredList
    return filteredList.filter((q) => q.status === status)
  }, [quotations, status, leads, siteVisits, marketingSiteProducts, portal])

  const dropdownOptions = portal === 'Quotation Dashboard'
    ? ['All Status', 'Sent', 'Customer Review', 'Revision Required', 'Customer Approved', 'Customer Rejected', 'Expired']
    : STATUS_OPTIONS

  async function submitRejection(e: React.FormEvent) {
    e.preventDefault()
    if (!rejecting || !rejectionReason.trim()) return
    await updateQuotationStatus(rejecting.id, 'Customer Rejected', { customerRejectionReason: rejectionReason })
    setRejecting(null)
    setRejectionReason('')
  }
  
  const paginatedList = useMemo(() => visible.slice((currentPage - 1) * 25, currentPage * 25), [visible, currentPage])

  const columns: Column<Quotation>[] = [
    { header: 'Quotation #', cell: (q) => <span className="font-mono text-xs text-teal">{(q.status === 'Quotation Created' && q.grandTotal === 0) ? 'Pending' : q.quotationNumber}</span> },
    {
      header: 'Customer', cell: (q) => (
        <div>
          <div className="font-medium">{q.customerName}</div>
          <div className="text-xs text-text-dim">{q.site}</div>
        </div>
      )
    },
    { header: 'Type', cell: (q) => q.projectType },
    { header: 'Grand Total', cell: (q) => formatINR(q.grandTotal) },
    { header: 'Advance', cell: (q) => formatINR(q.advanceAmount) },
    { header: 'Prepared By', cell: (q) => <span>{q.preparedBy}{q.createdByCeo && <span className="text-sun"> · CEO</span>}</span> },
    { header: 'Rev.', cell: (q) => (q.status === 'Quotation Created' || q.status === 'Submitted') ? '-' : (q.revisionNumber > 0 ? `v${q.revisionNumber + 1}` : 'v1') },
    { header: 'Valid Until', cell: (q) => <span className="text-text-dim">{formatDate(q.validUntil)}</span> },
    { header: 'Status', cell: (q) => <Pill status={q.status} label={(q.status === 'Quotation Created' && q.grandTotal === 0) ? 'Quotation Stage' : q.status} /> },
    { header: '', cell: (q) => <QuotationActions q={q} onEdit={setEditingQuotation} onReject={setRejecting} onDelete={setDeleting} /> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Marketing → Quotation"
        title="Quotations"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCatalog(true)}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>📦</span> Product Catalog
            </button>
            <button
              type="button"
              onClick={() => setShowBuilder(true)}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs hover:shadow active:scale-[0.99] cursor-pointer"
            >
              + New Quotation
            </button>
          </div>
        }
      />
      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
          {dropdownOptions.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/60 ml-auto">{visible.length} quotations</span>
      </Card>
      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedList}
          keyFn={(q) => q.id}
          mobileCard={(q) => (
            <Card className="p-5 space-y-2.5">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{q.customerName}</div>
                  <div className="font-mono text-[11px] text-emerald-700 font-semibold">{q.quotationNumber}</div>
                </div>
                <Pill status={q.status} />
              </div>
              <div className="text-xs text-slate-600 font-medium">{q.projectType} · {formatINR(q.grandTotal)}</div>
              <div className="text-xs text-slate-400">Valid until {formatDate(q.validUntil)}</div>
              <div className="pt-2 border-t border-slate-100">
                <QuotationActions q={q} onEdit={setEditingQuotation} onReject={setRejecting} onDelete={setDeleting} />
              </div>
            </Card>
          )}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={visible.length}
          onPageChange={setCurrentPage}
        />
      </div>
      <p className="text-[11px] text-slate-500 font-medium">Editing a quotation increments its version (v1 → v2 → v3) on the same quotation record.</p>

      {showBuilder && <QuotationBuilder onClose={() => setShowBuilder(false)} />}
      {editingQuotation && <QuotationBuilder quotation={editingQuotation} onClose={() => setEditingQuotation(null)} />}
      {showCatalog && <ProductCatalogModal onClose={() => setShowCatalog(false)} />}

      {rejecting && (
        <Modal title={`Customer Rejected — ${rejecting.quotationNumber}`} onClose={() => setRejecting(null)}>
          <form onSubmit={submitRejection} className="space-y-4">
            <p className="text-xs text-slate-600">Record why the customer rejected this quotation. This is kept on the quotation record for reference.</p>
            <Field label="Rejection Reason">
              <textarea required className={inputCls} rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Customer went with a competitor's quote" />
            </Field>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setRejecting(null)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 cursor-pointer">Cancel</button>
              <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer">Record Rejection</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Confirm Delete" onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-bold text-sm">Delete Quotation {deleting.quotationNumber}?</div>
                <div className="text-xs text-rose-600 mt-0.5">
                  Customer: <strong>{deleting.customerName}</strong> ({formatINR(deleting.grandTotal)})
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this quotation record? This action will permanently remove it from the system.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteQuotation(deleting.id)
                  setDeleting(null)
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Yes, Delete Quotation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
