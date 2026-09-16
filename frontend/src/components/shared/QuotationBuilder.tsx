import { useMemo, useState } from 'react'
import { Modal, Field, inputCls } from './Primitives'
import { ProductCatalogModal } from './ProductCatalogModal'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import type { Lead, QuotationLineItem, Quotation } from '../../types/models'
import { formatINR } from '../../lib/utils'

let rowCounter = 1
function emptyRow(): QuotationLineItem {
  return {
    id: `row${rowCounter++}`,
    product: '',
    description: '',
    quantity: 1,
    unit: '1.0',
    unitPrice: 0,
    discount: 0,
    gstPercent: 18,
    labourCharge: 0
  }
}

const PROJECT_TYPES = ['Residential Rooftop', 'Commercial Rooftop', 'Industrial', 'Battery Add-on', 'Maintenance']

const DEFAULT_PAYMENT_TERMS =
  `Payment: 50% advance payment & 50% Payment on after Material delivery With Work Completion.
• Scope of Customer: Water, Electricity and space for installation, construction of control room
• Net meter Payment: Application and arrangement is our scope and its Related cost to Be borne by client scope.
• Civil: customer scope
* Note: It is important to note that the balance payment should be settled after the completion of solar work and this has nothing to do with E.B work sir`

const DEFAULT_INSTALLATION_TERMS =
  `• GST: 18% Included.
• Mounting work : Included
• Transport : Included.
• Installation: Included
• Validity to quote: 15Days
• Project time:10 To 15days
• Mounting structure: Included`

const DEFAULT_WARRANTY_TERMS =
  `• Warranty:10 Years for Inverter & 30 years Performance Warranty for Panel`

export function QuotationBuilder({
  lead,
  quotation,
  onClose,
  onCreated,
}: {
  lead?: Lead | null
  quotation?: Quotation | null
  onClose: () => void
  onCreated?: () => void
}) {
  const { employee, portal } = useAuth()
  const { addQuotation, updateQuotation, products, leads } = useApp()

  const [payloadLeadId, setPayloadLeadId] = useState(quotation?.leadId || lead?.id || '')
  const [customerName, setCustomerName] = useState(quotation?.customerName ?? lead?.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(quotation?.customerPhone ?? lead?.mobile ?? '')
  const [ebNumber, setEbNumber] = useState(quotation?.ebNumber ?? '')
  const [solarPanel, setSolarPanel] = useState(quotation?.solarPanel ?? '')
  const [solarInverter, setSolarInverter] = useState(quotation?.solarInverter ?? '')
  const [showProductManager, setShowProductManager] = useState(false)
  const [site, setSite] = useState(quotation?.site ?? (lead ? `${lead.address}, ${lead.area}` : ''))
  const [projectType, setProjectType] = useState(quotation?.projectType ?? PROJECT_TYPES[0])
  const [validUntil, setValidUntil] = useState(() => {
    if (quotation?.validUntil) return quotation.validUntil.slice(0, 10)
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [advancePercentage, setAdvancePercentage] = useState(50)
  const [paymentTerms, setPaymentTerms] = useState(quotation?.paymentTerms || DEFAULT_PAYMENT_TERMS)
  const [installationTerms, setInstallationTerms] = useState(quotation?.installationTerms || DEFAULT_INSTALLATION_TERMS)
  const [warrantyTerms, setWarrantyTerms] = useState(quotation?.warrantyTerms || DEFAULT_WARRANTY_TERMS)
  const [notes] = useState('')
  const { siteVisits, marketingSiteProducts } = useApp()

  const [items, setItems] = useState<QuotationLineItem[]>(() => {
    if (quotation?.lineItems && quotation.lineItems.length > 0) {
      return quotation.lineItems
    }
    
    const targetLeadId = lead?.id || quotation?.leadId
    if (targetLeadId) {
      const visit = siteVisits.find(v => v.leadId === targetLeadId && v.status === 'Completed') || marketingSiteProducts?.find(v => v.leadId === targetLeadId && v.status === 'Completed')
      if (visit?.rawMaterialDetails && visit.rawMaterialDetails.length > 0) {
        return visit.rawMaterialDetails.map((rm) => ({
          id: `row${rowCounter++}`,
          product: rm.itemName,
          quantity: rm.quantity,
          unit: 'Nos',
          unitPrice: 0,
          discount: 0,
          gstPercent: 18,
          labourCharge: 0
        }))
      }
    }
    return [emptyRow()]
  })

  const isCeo = portal === 'CEO'

  const totals = useMemo(() => {
    let subtotal = 0, discountTotal = 0, taxTotal = 0, labourTotal = 0
    for (const it of items) {
      const lineBase = it.quantity * it.unitPrice
      const lineDiscount = lineBase * (it.discount / 100)
      const lineTaxable = lineBase - lineDiscount
      const lineTax = lineTaxable * (it.gstPercent / 100)
      subtotal += lineBase
      discountTotal += lineDiscount
      taxTotal += lineTax
      labourTotal += it.labourCharge
    }
    const grandTotal = Math.round(subtotal - discountTotal + taxTotal + labourTotal)
    const advanceAmount = Math.round(grandTotal * (advancePercentage / 100))
    return { subtotal, discountTotal, taxTotal, labourTotal, grandTotal, advanceAmount, balanceAmount: grandTotal - advanceAmount }
  }, [items, advancePercentage])

  function updateInstallationTermsGst(newGst: number) {
    setInstallationTerms((prev) => {
      const gstRegex = /•\s*GST:\s*\d+%\s*Included\./i
      const newGstLine = `• GST: ${newGst}% Included.`
      if (gstRegex.test(prev)) {
        return prev.replace(gstRegex, newGstLine)
      }
      const flexibleGst = /•\s*GST:[^\n]*/i
      if (flexibleGst.test(prev)) {
        return prev.replace(flexibleGst, newGstLine)
      }
      return `${newGstLine}\n` + prev
    })
  }

  function handleAdvancePercentageChange(newVal: number) {
    setAdvancePercentage(newVal)
    const remaining = Math.max(0, 100 - newVal)
    setPaymentTerms((prev) => {
      const regex = /Payment:\s*\d+%\s*advance\s*payment\s*&\s*\d+%\s*Payment\s*on\s*after\s*Material\s*delivery\s*With\s*Work\s*Completion\./i
      const newHeader = `Payment: ${newVal}% advance payment & ${remaining}% Payment on after Material delivery With Work Completion.`
      if (regex.test(prev)) {
        return prev.replace(regex, newHeader)
      }
      const flexibleRegex = /Payment:\s*\d+%\s*advance\s*payment\s*&\s*\d+%\s*Payment[^\n]*/i
      if (flexibleRegex.test(prev)) {
        return prev.replace(flexibleRegex, `Payment: ${newVal}% advance payment & ${remaining}% Payment on after Material delivery With Work Completion.`)
      }
      return `${newHeader}\n` + prev
    })
  }

  function updateRow(id: string, patch: Partial<QuotationLineItem>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    if (patch.gstPercent !== undefined) {
      updateInstallationTermsGst(patch.gstPercent)
    }
  }

  function handleProductSelect(rowId: string, selectedName: string) {
    if (!selectedName) {
      updateRow(rowId, { product: '', description: '', unitPrice: 0 })
      return
    }
    const match = products.find((p) => p.name === selectedName)
    if (match) {
      const gst = match.gstPercent ?? 18
      updateRow(rowId, {
        product: match.name,
        description: match.description,
        unit: match.unit === 'Kilowatt' ? '1.0' : match.unit,
        unitPrice: match.unitPrice,
        gstPercent: gst,
      })
      updateInstallationTermsGst(gst)
    } else {
      updateRow(rowId, { product: selectedName })
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee || !customerName || !site) return

    const validItems = items.filter((it) => it.product && it.product.trim().length > 0)
    if (validItems.length === 0) {
      alert("Please select at least one product in Line Items.")
      return
    }

    const payload = {
      customerName: String(customerName || '').trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : '',
      site: String(site || '').trim(),
      date: quotation?.date ?? new Date().toISOString().slice(0, 10),
      validUntil,
      preparedBy: quotation?.preparedBy ?? employee.name,
      preparedById: quotation?.preparedById ?? employee.id,
      projectType,
      lineItems: validItems.map((it, idx) => ({
        ...it,
        unit: String(it.unit ?? '1.0'),
        sortOrder: idx,
      })),
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      labourTotal: totals.labourTotal,
      grandTotal: totals.grandTotal,
      advancePercentage,
      advanceAmount: totals.advanceAmount,
      balanceAmount: totals.balanceAmount,
      paymentTerms,
      installationTerms,
      warrantyTerms,
      notes,
      ebNumber: String(ebNumber).trim(),
      solarPanel,
      solarInverter,
      status: quotation?.status ?? 'Quotation Created',
      leadId: payloadLeadId || undefined,
      createdByCeo: quotation?.createdByCeo ?? isCeo,
    }

    if (quotation) {
      await updateQuotation(quotation.id, payload)
    } else {
      await addQuotation(payload)
    }

    onCreated?.()
    onClose()
  }

  const isPreSent = !quotation || quotation.status === 'Quotation Created' || quotation.status === 'Submitted'
  const isPlaceholder = quotation?.status === 'Quotation Created' && quotation?.grandTotal === 0

  const currentRev = quotation?.revisionNumber ?? 0
  const currentVersionLabel = `v${currentRev + 1}`
  const nextVersionLabel = `v${currentRev + 2}`

  const modalTitle = quotation
    ? isPlaceholder
      ? `Create Quotation — ${quotation.customerName}`
      : isPreSent
        ? `Edit Quotation — ${quotation.quotationNumber}`
        : `Edit Quotation — ${quotation.quotationNumber} (${currentVersionLabel} → ${nextVersionLabel})`
    : lead
      ? `New Quotation — ${lead.customerName}`
      : 'New Quotation'

  const submitBtnText = quotation
    ? isPlaceholder
      ? 'Create Quotation'
      : isPreSent
        ? 'Save Changes'
        : `Save Changes (${nextVersionLabel})`
    : 'Create Quotation'

  return (
    <Modal
      title={modalTitle}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Customer">
            {lead ? (
              <input required className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={true} />
            ) : (
              <select required className={inputCls} value={payloadLeadId} onChange={(e) => {
                setPayloadLeadId(e.target.value)
                const selected = leads.find(l => l.id === e.target.value)
                if (selected) {
                  setCustomerName(selected.customerName)
                  setCustomerPhone(selected.mobile)
                  setSite(selected.address || selected.city || '')
                }
              }}>
                <option value="">-- Select a Lead (Optional) --</option>
                {leads
                  .filter(l => l.status !== 'Converted' && l.status !== 'Not Interested')
                  .filter(l => 
                    l.status === 'Quotation Stage' || 
                    siteVisits.some(v => v.leadId === l.id && v.status === 'Completed') || 
                    marketingSiteProducts?.some(v => v.leadId === l.id && v.status === 'Completed')
                  )
                  .map(l => (
                    <option key={l.id} value={l.id}>{l.customerName} ({l.mobile})</option>
                  ))}
              </select>
            )}
          </Field>
          <Field label="Address"><input required className={inputCls} value={site} onChange={(e) => setSite(e.target.value)} /></Field>
          <Field label="Project Type">
            <select className={inputCls} value={projectType} onChange={(e) => setProjectType(e.target.value)}>
              {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Valid Until"><input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
          <Field label="Phone No">
            <input className={inputCls} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </Field>
          <Field label="EB Number">
            <input className={inputCls} value={ebNumber} onChange={(e) => setEbNumber(e.target.value)} onFocus={(e) => e.target.select()} />
          </Field>
        </div>

        <div className="border-t border-border pt-4">
          <div className="text-[11px] uppercase tracking-wide text-text-dim font-semibold mb-3">System Specifications</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Solar Panel Brand">
              <input required className={inputCls} value={solarPanel} onChange={(e) => setSolarPanel(e.target.value)} />
            </Field>
            <Field label="Solar Inverter Brand">
              <input required className={inputCls} value={solarInverter} onChange={(e) => setSolarInverter(e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-text-dim font-semibold">Line Items & Products</span>
              <button
                type="button"
                onClick={() => setShowProductManager(true)}
                className="text-xs text-white font-semibold flex items-center gap-1 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                + Add New Product
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.id} className="bg-panel-raised border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-teal uppercase tracking-wider">Item #{idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((r) => r.id !== it.id))}
                      className="text-xs text-rose hover:underline"
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[4fr_1.5fr_2fr_2.5fr_2fr_2fr] gap-2 items-center">
                  {/* Scroll-down Product Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-dim uppercase font-medium">Product / Name</label>
                    <select
                      className={`${inputCls} text-xs font-medium cursor-pointer`}
                      value={it.product}
                      onChange={(e) => handleProductSelect(it.id, e.target.value)}
                    >
                      <option value="">-- Scroll & Select Product --</option>
                      {Array.from(new Set(products.map((p) => p.category))).map((cat) => (
                        <optgroup key={cat} label={`📦 ${cat}`}>
                          {products
                            .filter((p) => p.category === cat)
                            .map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.name} ({formatINR(p.unitPrice)} / {p.unit})
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-dim uppercase font-medium">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={it.quantity}
                      onChange={(e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value)) })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>

                  {/* Kilowatt */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-dim uppercase font-medium">Kilowatt</label>
                    <input
                      className={inputCls}
                      value={it.unit}
                      onChange={(e) => updateRow(it.id, { unit: e.target.value })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-dim uppercase font-medium">Unit Price (₹)</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={it.unitPrice === 0 ? '' : it.unitPrice}
                      onChange={(e) => updateRow(it.id, { unitPrice: Number(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>

                  {/* GST % */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-dim uppercase font-medium">GST %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputCls}
                      value={it.gstPercent === 0 ? '' : it.gstPercent}
                      onChange={(e) => updateRow(it.id, { gstPercent: Number(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>

                  {/* Discount */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-dim uppercase font-medium">Disc %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputCls}
                      value={it.discount === 0 ? '' : it.discount}
                      onChange={(e) => updateRow(it.id, { discount: Number(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>

                {/* Auto-filled Product Description */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-text-dim uppercase font-medium">Product Description</label>
                  </div>
                  <textarea
                    rows={5}
                    className={`${inputCls} text-xs text-text bg-panel/50 font-sans leading-relaxed`}
                    value={it.description || ''}
                    onChange={(e) => updateRow(it.id, { description: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((prev) => [...prev, emptyRow()])} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline mt-2.5 inline-block cursor-pointer">+ Add another line item</button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Advance %">
            <input
              type="number"
              min={0}
              max={100}
              className={inputCls}
              value={advancePercentage}
              onChange={(e) => handleAdvancePercentageChange(Number(e.target.value))}
              onFocus={(e) => e.target.select()}
            />
          </Field>
          <div className="sm:col-span-2 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50/90 border border-[#e2e8e5] rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Grand Total</div><div className="font-bold text-base text-slate-900 mt-0.5">{formatINR(totals.grandTotal)}</div></div>
            <div className="bg-slate-50/90 border border-[#e2e8e5] rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-slate-500">Advance / Balance</div><div className="font-bold text-sm text-emerald-700 mt-0.5">{formatINR(totals.advanceAmount)} / {formatINR(totals.balanceAmount)}</div></div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={<span>Payment Terms</span>}>
            <textarea
              className={`${inputCls} font-sans text-xs leading-relaxed ${!isCeo ? 'bg-slate-100/60 cursor-not-allowed opacity-75' : ''}`}
              rows={8}
              value={paymentTerms}
              disabled={!isCeo}
              readOnly={!isCeo}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </Field>
          <Field label={<span>Installation Terms </span>}>
            <textarea
              className={`${inputCls} font-sans text-xs leading-relaxed ${!isCeo ? 'bg-slate-100/60 cursor-not-allowed opacity-75' : ''}`}
              rows={8}
              value={installationTerms}
              disabled={!isCeo}
              readOnly={!isCeo}
              onChange={(e) => setInstallationTerms(e.target.value)}
            />
          </Field>
          <Field label={<span>Warranty Terms</span>}>
            <textarea
              className={`${inputCls} font-sans text-xs leading-relaxed ${!isCeo ? 'bg-slate-100/60 cursor-not-allowed opacity-75' : ''}`}
              rows={4}
              value={warrantyTerms}
              disabled={!isCeo}
              readOnly={!isCeo}
              onChange={(e) => setWarrantyTerms(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 cursor-pointer">Cancel</button>
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer">
            {submitBtnText}
          </button>
        </div>
      </form>
      {showProductManager && <ProductCatalogModal initialAdd={true} onClose={() => setShowProductManager(false)} />}
    </Modal>
  )
}

