import { useMemo, useState } from 'react'
import { Eye, Pencil, Download, FileText, Loader2 } from 'lucide-react'
import { Card, EmptyState, Pill, SectionHeading } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import { useApp } from '../store/AppStore'
import type { Invoice, Quotation } from '../types/models'
import { formatINR } from '../lib/utils'
import { openInvoiceDocument, downloadInvoicePDF } from '../lib/invoiceDoc'
import { InvoiceBuilder } from '../components/shared/InvoiceBuilder'

export default function Invoices() {
  const { quotations, invoices } = useApp()
  const [activeBuilder, setActiveBuilder] = useState<{ quotation: Quotation; invoice?: Invoice | null } | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const approved = useMemo(() => {
    const latestMap = new Map<string, Quotation>()
    for (const q of quotations) {
      const existing = latestMap.get(q.quotationNumber)
      if (!existing || (q.revisionNumber ?? 0) >= (existing.revisionNumber ?? 0)) {
        latestMap.set(q.quotationNumber, q)
      }
    }
    return Array.from(latestMap.values()).filter(
      (quotation) => quotation.status === 'Verified'
    )
  }, [quotations])

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedApproved = useMemo(() => approved.slice((currentPage - 1) * 25, currentPage * 25), [approved, currentPage])

  const invoiceFor = (quotation: Quotation) =>
    invoices.find(
      (invoice) =>
        (invoice.quotationId && invoice.quotationId === quotation.id) ||
        (invoice.quotationNumber && quotation.quotationNumber && invoice.quotationNumber === quotation.quotationNumber)
    )

  const preview = (invoice: Invoice, quotation: Quotation) => {
    openInvoiceDocument(invoice, quotation, false)
  }

  const handleDownload = async (invoice: Invoice, quotation: Quotation) => {
    try {
      setDownloadingId(invoice.id)
      await downloadInvoicePDF(invoice, quotation)
    } catch (err) {
      console.error('Failed to download invoice PDF', err)
      alert('Could not download PDF directly. Opening document view instead.')
      openInvoiceDocument(invoice, quotation, true)
    } finally {
      setDownloadingId(null)
    }
  }

  const columns: Column<Quotation>[] = [
    {
      header: 'Invoice #',
      cell: (quotation) => {
        const invoice = invoiceFor(quotation)
        return invoice ? (
          <span className="font-mono text-xs font-bold text-teal">{invoice.invoiceNumber}</span>
        ) : (
          <span className="text-xs text-text-dim italic">Not generated</span>
        )
      },
    },
    {
      header: 'Customer',
      cell: (quotation) => (
        <div>
          <div className="font-medium text-text">{quotation.customerName}</div>
          <div className="text-xs text-text-dim">{quotation.site}</div>
        </div>
      ),
    },
    {
      header: 'Quotation #',
      cell: (quotation) => <span className="font-mono text-xs text-text-dim">{quotation.quotationNumber}</span>,
    },
    {
      header: 'Total Value',
      cell: (quotation) => {
        const invoice = invoiceFor(quotation)
        return <span className="font-medium">{formatINR(invoice?.grandTotal ?? quotation.grandTotal)}</span>
      },
    },
    {
      header: 'Advance Paid',
      cell: (quotation) => {
        const invoice = invoiceFor(quotation)
        return <span className="text-xs text-emerald-600 font-semibold">{formatINR(invoice?.advanceAmount ?? quotation.advanceAmount)}</span>
      },
    },
    {
      header: 'Balance Due',
      cell: (quotation) => {
        const invoice = invoiceFor(quotation)
        return <span className="text-xs text-amber-700 font-bold">{formatINR(invoice?.balanceAmount ?? quotation.balanceAmount)}</span>
      },
    },
    {
      header: 'Status',
      cell: (quotation) => {
        const invoice = invoiceFor(quotation)
        return <Pill status={invoice ? 'Verified' : 'Ready to generate'} label={invoice ? 'Generated' : 'Ready to generate'} />
      },
    },
    {
      header: 'Actions',
      cell: (quotation) => {
        const invoice = invoiceFor(quotation)
        return (
          <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
            {invoice ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveBuilder({ quotation, invoice })}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Edit Invoice"
                  aria-label="Edit Invoice"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => preview(invoice, quotation)}
                  className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title="Preview Invoice"
                  aria-label="Preview Invoice"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(invoice, quotation)}
                  disabled={downloadingId === invoice.id}
                  className="p-2 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Download Invoice PDF"
                  aria-label="Download Invoice PDF"
                >
                  {downloadingId === invoice.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveBuilder({ quotation, invoice: null })}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold inline-flex gap-1.5 items-center transition-all shadow-xs cursor-pointer"
              >
                Create Tax Invoice
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Billing & Accounts" title="Tax Invoices" />

      <Card className="p-5 bg-white border border-[#e2e8e5] rounded-2xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
            <FileText size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Customer Tax Invoices</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified payment quotations automatically appear here ready for tax invoice generation and printing.
            </p>
          </div>
        </div>
      </Card>

      {approved.length ? (
        <div className="flex flex-col drop-shadow-xs">
          <DataTable
            columns={columns}
            rows={paginatedApproved}
            keyFn={(quotation) => quotation.id}
            mobileCard={(quotation) => {
              const invoice = invoiceFor(quotation)
              return (
                <Card className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-text">{quotation.customerName}</div>
                      <div className="text-xs text-text-dim">{quotation.quotationNumber}</div>
                    </div>
                    <Pill status={invoice ? 'Generated' : 'Ready to generate'} />
                  </div>
                  <div className="text-xs text-text-dim">{quotation.site}</div>
                  <div className="flex justify-between text-xs pt-2 border-t border-border">
                    <span>Total: <strong>{formatINR(invoice?.grandTotal ?? quotation.grandTotal)}</strong></span>
                    <span>Balance: <strong className="text-sun">{formatINR(invoice?.balanceAmount ?? quotation.balanceAmount)}</strong></span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {invoice ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveBuilder({ quotation, invoice })}
                          className="flex-1 py-2 flex items-center justify-center bg-panel-raised border border-border rounded-lg text-text-dim hover:text-text"
                          title="Edit Invoice"
                          aria-label="Edit Invoice"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => preview(invoice, quotation)}
                          className="flex-1 py-2 flex items-center justify-center bg-teal/10 border border-teal/30 text-teal rounded-lg hover:bg-teal/20"
                          title="Preview Invoice"
                          aria-label="Preview Invoice"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(invoice, quotation)}
                          disabled={downloadingId === invoice.id}
                          className="flex-1 py-2 flex items-center justify-center bg-sun/10 border border-sun/30 text-sun rounded-lg hover:bg-sun/20 disabled:opacity-50"
                          title="Download Invoice PDF"
                          aria-label="Download Invoice PDF"
                        >
                          {downloadingId === invoice.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setActiveBuilder({ quotation, invoice: null })} className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-xs transition">
                        Create Tax Invoice
                      </button>
                    )}
                  </div>
                </Card>
              )
            }}
          />
          <Pagination currentPage={currentPage} totalItems={approved.length} onPageChange={setCurrentPage} />
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No verified payments yet"
            message="Customer quotations will appear here as soon as a customer payment is verified by the accounts department."
          />
        </Card>
      )}

      {activeBuilder && (
        <InvoiceBuilder
          quotation={activeBuilder.quotation}
          invoice={activeBuilder.invoice}
          onClose={() => setActiveBuilder(null)}
          onSaved={() => setActiveBuilder(null)}
        />
      )}
    </div>
  )
}
