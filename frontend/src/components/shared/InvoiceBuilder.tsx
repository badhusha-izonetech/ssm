import { useEffect, useMemo, useState } from 'react'
import { Modal, Field, inputCls } from './Primitives'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { invoicesApi } from '../../api/invoices'
import type { Invoice, Quotation, QuotationLineItem } from '../../types/models'
import { formatINR } from '../../lib/utils'
import { openInvoiceDocument } from '../../lib/invoiceDoc'
import { Eye, Plus, Trash2 } from 'lucide-react'

export function InvoiceBuilder({
  quotation,
  invoice,
  onClose,
  onSaved,
}: {
  quotation?: Quotation | null
  invoice?: Invoice | null
  onClose: () => void
  onSaved?: () => void
}) {
  const { invoices, updateInvoice, generateInvoice, refreshInvoices } = useApp()
  const { employee } = useAuth()

  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber || '')

  useEffect(() => {
    if (invoice?.invoiceNumber) {
      setInvoiceNumber(invoice.invoiceNumber)
      return
    }
    let isCancelled = false
    invoicesApi.getNextNumber().then((res) => {
      if (!isCancelled && res?.nextInvoiceNumber) {
        setInvoiceNumber(res.nextInvoiceNumber)
      }
    }).catch(() => {
      if (!isCancelled) {
        const year = new Date().getFullYear()
        let maxSeq = 0
        for (const inv of invoices) {
          const m = inv.invoiceNumber?.match(/(\d+)$/)
          if (m) {
            const seq = parseInt(m[1], 10)
            if (seq > maxSeq) maxSeq = seq
          }
        }
        setInvoiceNumber(`SSC-INV-${year}-${String(maxSeq + 1).padStart(4, '0')}`)
      }
    })
    return () => { isCancelled = true }
  }, [invoice, invoices])
  const [quotationNumber] = useState(invoice?.quotationNumber || quotation?.quotationNumber || '')
  const [customerName, setCustomerName] = useState(invoice?.customerName || quotation?.customerName || '')
  const [customerPhone, setCustomerPhone] = useState(quotation?.customerPhone || '')
  const [billingAddress, setBillingAddress] = useState(invoice?.billingAddress || invoice?.site || quotation?.site || '')
  const [projectType, setProjectType] = useState(invoice?.projectType || quotation?.projectType || 'Residential Rooftop')
  const [ebNumber, setEbNumber] = useState(quotation?.ebNumber || '')

  const [issueDate, setIssueDate] = useState(() => invoice?.issueDate || new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => invoice?.dueDate || new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(invoice?.notes || quotation?.notes || '')

  const [solarPanel, setSolarPanel] = useState(quotation?.solarPanel || 'VIKRAM BIFACIAL DCR SOLAR PANEL (GOVT. ALMM APPROVED)')
  const [solarInverter, setSolarInverter] = useState(quotation?.solarInverter || 'VSOLE INVERTER (BIS STANDARD APPROVED)')

  const [paymentTerms, setPaymentTerms] = useState(
    invoice?.paymentTerms ||
    quotation?.paymentTerms ||
    '• Payment terms as agreed per verified order schedule.\n' +
    '• All payments via Cheque / RTGS / NEFT / UPI to company account.\n' +
    '• Net meter application is supported by Success Solar Power Care.\n' +
    '* Note: Balance payment settlement is linked to work completion on site.'
  )

  const [installationTerms, setInstallationTerms] = useState(
    invoice?.installationTerms ||
    quotation?.installationTerms ||
    '• GST: 18% Included.\n' +
    '• Transport & Delivery: Included to customer site.\n' +
    '• Mounting structure & civil support: Included.\n' +
    '• Warranty: 10 Years Inverter & 30 Years Solar Panel.'
  )

  const [termsAndConditions, setTermsAndConditions] = useState(
    invoice?.termsAndConditions ||
    quotation?.termsAndConditions ||
    '1. Goods once sold cannot be returned or exchanged without prior written consent.\n' +
    '2. Warranty coverage is provided directly by respective original equipment manufacturers (OEMs).\n' +
    '3. Grid connectivity and EB net meter approval timelines depend on state electricity board norms.\n' +
    '4. Customer must ensure unobstructed roof access and water supply for routine panel cleaning.\n' +
    '5. Subject to Tiruchirappalli jurisdiction.'
  )

  const [items, setItems] = useState<QuotationLineItem[]>(() => {
    if (quotation?.lineItems && quotation.lineItems.length > 0) {
      return quotation.lineItems
    }
    return [
      {
        id: 'item1',
        product: 'Power Plant (On-Grid and Off-Grid)',
        description: '• 5 kW On-Grid Solar Power System\n• Mono-crystalline Panels & Grid-tied Inverter',
        quantity: 1,
        unit: '1.0 kW',
        unitPrice: invoice?.grandTotal || quotation?.grandTotal || 48000,
        discount: 0,
        gstPercent: 18,
        labourCharge: 0,
      },
    ]
  })

  // Live Calculations
  const totals = useMemo(() => {
    let subtotal = 0, discountTotal = 0, taxTotal = 0, labourTotal = 0
    for (const it of items) {
      const lineBase = it.quantity * it.unitPrice
      const lineDiscount = lineBase * ((it.discount || 0) / 100)
      const lineTaxable = lineBase - lineDiscount
      const lineTax = lineTaxable * ((it.gstPercent || 0) / 100)
      subtotal += lineBase
      discountTotal += lineDiscount
      taxTotal += lineTax
      labourTotal += it.labourCharge || 0
    }
    const grandTotal = Math.round(subtotal - discountTotal + taxTotal + labourTotal)
    const advanceAmount = invoice?.advanceAmount ?? quotation?.advanceAmount ?? Math.round(grandTotal * 0.7)
    const balanceAmount = Math.max(0, grandTotal - advanceAmount)

    return {
      subtotal,
      discountTotal,
      taxable: subtotal - discountTotal,
      taxTotal,
      labourTotal,
      grandTotal,
      advanceAmount,
      balanceAmount,
    }
  }, [items, invoice, quotation])

  function updateItem(index: number, patch: Partial<QuotationLineItem>) {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], ...patch }
      return updated
    })
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        product: 'Solar Component',
        description: '',
        quantity: 1,
        unit: 'NOS',
        unitPrice: 1000,
        discount: 0,
        gstPercent: 18,
        labourCharge: 0,
      },
    ])
  }

  function removeItem(index: number) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!quotation) return

    const invoicePayload: Partial<Invoice> = {
      invoiceNumber,
      quotationId: quotation.id,
      quotationNumber,
      customerName,
      site: billingAddress,
      billingAddress,
      projectType,
      issueDate,
      dueDate,
      notes,
      paymentTerms,
      installationTerms,
      termsAndConditions,
      grandTotal: totals.grandTotal,
      advanceAmount: totals.advanceAmount,
      balanceAmount: totals.balanceAmount,
      taxableAmount: totals.taxable,
      gstPercent: totals.taxable > 0 ? Math.round((totals.taxTotal / totals.taxable) * 100) : 18,
      gstAmount: totals.taxTotal,
    }

    if (invoice?.id) {
      await updateInvoice(invoice.id, invoicePayload)
    } else {
      await generateInvoice(quotation, invoicePayload)
    }

    await refreshInvoices()
    if (onSaved) onSaved()
    onClose()
  }

  function handlePreview() {
    const currentInv: Invoice = {
      id: invoice?.id || 'temp-id',
      invoiceNumber,
      quotationId: quotation?.id || '',
      quotationNumber,
      customerName,
      site: billingAddress,
      billingAddress,
      projectType,
      issueDate,
      dueDate,
      notes,
      paymentTerms,
      installationTerms,
      termsAndConditions,
      grandTotal: totals.grandTotal,
      advanceAmount: totals.advanceAmount,
      balanceAmount: totals.balanceAmount,
      taxableAmount: totals.taxable,
      gstPercent: totals.taxable > 0 ? Math.round((totals.taxTotal / totals.taxable) * 100) : 18,
      gstAmount: totals.taxTotal,
    }

    const currentQuot: Quotation = {
      ...(quotation || {} as any),
      customerName,
      customerPhone,
      site: billingAddress,
      projectType,
      ebNumber,
      solarPanel,
      solarInverter,
      paymentTerms,
      installationTerms,
      termsAndConditions,
      lineItems: items,
      grandTotal: totals.grandTotal,
      advanceAmount: totals.advanceAmount,
      balanceAmount: totals.balanceAmount,
    }

    openInvoiceDocument(currentInv, currentQuot)
  }

  return (
    <Modal title={`Tax Invoice — ${invoiceNumber}`} onClose={onClose} wide>
      <form onSubmit={handleSave} className="space-y-6">
        {/* Header Info */}
        <div className="bg-panel-raised border border-border rounded-xl p-4 grid sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-text-dim block">Invoice Number:</span>
            <span className="font-mono font-bold text-sun text-sm">{invoiceNumber}</span>
          </div>
          <div>
            <span className="text-text-dim block">Linked Quotation:</span>
            <span className="font-mono font-bold text-teal text-sm">{quotationNumber || '—'}</span>
          </div>
          <div>
            <span className="text-text-dim block">Created By / Authority:</span>
            <span className="font-medium text-text">{employee?.name || 'Authorized Official'}</span>
          </div>
        </div>

        {/* Customer & Billing Details (Auto-filled) */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sun">Customer & Billing Information</h4>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Customer Name">
              <input required className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </Field>
            <Field label="Customer Phone">
              <input className={inputCls} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number" />
            </Field>
            <Field label="Project Type">
              <input className={inputCls} value={projectType} onChange={(e) => setProjectType(e.target.value)} />
            </Field>
            <Field label="Invoice Date">
              <input type="date" required className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="Due Date">
              <input type="date" required className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="EB Consumer Number">
              <input className={inputCls} value={ebNumber} onChange={(e) => setEbNumber(e.target.value)} placeholder="e.g. 04-123-456-789" />
            </Field>
          </div>
          <Field label="Billing / Installation Site Address">
            <textarea rows={2} required className={inputCls} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Full street address with district and pin code" />
          </Field>
        </div>

        {/* Line Items Table (Auto-filled) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sun">Invoice Items & Pricing</h4>
            <button type="button" onClick={addItem} className="text-xs font-medium text-teal hover:underline inline-flex items-center gap-1">
              <Plus size={13} /> Add Line Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => {
              const lineTotal = Math.round(
                it.quantity * it.unitPrice * (1 - (it.discount || 0) / 100) * (1 + (it.gstPercent || 0) / 100) + (it.labourCharge || 0)
              )
              return (
                <div key={it.id || idx} className="p-3 bg-panel-raised border border-border rounded-xl space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 grid sm:grid-cols-2 gap-2">
                      <Field label="Product / Description">
                        <input className={inputCls} value={it.product} onChange={(e) => updateItem(idx, { product: e.target.value })} />
                      </Field>
                      <Field label="Capacity / Unit">
                        <input className={inputCls} value={it.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })} placeholder="e.g. 5 kW, NOS, SET" />
                      </Field>
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-rose hover:bg-rose/10 p-1.5 rounded-lg transition-colors mt-4">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <Field label="Quantity">
                      <input type="number" min={1} className={inputCls} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} />
                    </Field>
                    <Field label="Unit Rate (₹)">
                      <input type="number" min={0} className={inputCls} value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })} />
                    </Field>
                    <Field label="Discount %">
                      <input type="number" min={0} max={100} className={inputCls} value={it.discount} onChange={(e) => updateItem(idx, { discount: Number(e.target.value) || 0 })} />
                    </Field>
                    <Field label="GST %">
                      <input type="number" min={0} max={28} className={inputCls} value={it.gstPercent} onChange={(e) => updateItem(idx, { gstPercent: Number(e.target.value) || 0 })} />
                    </Field>
                    <div className="flex flex-col justify-end">
                      <span className="text-[10px] text-text-dim uppercase font-semibold">Total</span>
                      <span className="font-mono font-bold text-teal text-sm py-2">{formatINR(lineTotal)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Specifications & Notes */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Solar Panel Spec">
            <input className={inputCls} value={solarPanel} onChange={(e) => setSolarPanel(e.target.value)} />
          </Field>
          <Field label="Solar Inverter Spec">
            <input className={inputCls} value={solarInverter} onChange={(e) => setSolarInverter(e.target.value)} />
          </Field>
        </div>

        <Field label="Invoice Notes / Special Terms">
          <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes to appear on tax invoice" />
        </Field>

        {/* Terms & Conditions Configuration */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sun">Payment, Installation & General Terms</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Payment Terms (Page 3 Left)">
              <textarea
                rows={4}
                className={`${inputCls} text-xs leading-relaxed`}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Payment terms..."
              />
            </Field>
            <Field label="Installation & Delivery Terms (Page 3 Right)">
              <textarea
                rows={4}
                className={`${inputCls} text-xs leading-relaxed`}
                value={installationTerms}
                onChange={(e) => setInstallationTerms(e.target.value)}
                placeholder="Installation & delivery terms..."
              />
            </Field>
          </div>
          <Field label="General Terms & Conditions (Page 4)">
            <textarea
              rows={4}
              className={`${inputCls} text-xs leading-relaxed`}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Terms & conditions..."
            />
          </Field>
        </div>

        {/* Totals Summary */}
        <div className="bg-panel-raised border border-border rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs text-text-dim">
            <span>Taxable Subtotal:</span>
            <span>{formatINR(totals.taxable)}</span>
          </div>
          <div className="flex justify-between text-xs text-text-dim">
            <span>GST Amount:</span>
            <span>{formatINR(totals.taxTotal)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-text border-t border-border pt-2">
            <span>Total Invoiced Value:</span>
            <span className="font-mono text-teal text-base">{formatINR(totals.grandTotal)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold text-emerald-600">
            <span>Advance Received & Verified:</span>
            <span className="font-mono">{formatINR(totals.advanceAmount)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-sun border-t border-dashed border-border pt-2">
            <span>Balance Due:</span>
            <span className="font-mono">{formatINR(totals.balanceAmount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button type="button" onClick={handlePreview} className="text-xs font-semibold px-4 py-2 rounded-lg bg-panel border border-border hover:bg-black/[0.04] transition-colors inline-flex items-center gap-1.5">
            <Eye size={14} className="text-teal" /> Preview Tax Invoice PDF
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-text-dim hover:text-text">
              Cancel
            </button>
            <button type="submit" className="bg-sun text-ink font-semibold px-5 py-2 rounded-lg text-xs hover:bg-sun/90 transition-colors">
              Save Tax Invoice
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
