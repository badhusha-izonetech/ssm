import { useState } from 'react'
import { Modal, Field, inputCls } from '../shared/Primitives'
import type { Lead, LeadSource } from '../../types/models'
import { useAuth } from '../../auth/AuthContext'
import { useApp } from '../../store/AppStore'

const LEAD_SOURCES: LeadSource[] = ['Previous Customer', 'Tele Calling', 'Inquiry Call', 'Walk-in', 'Justdial', 'IndiaMART', 'Google Search', 'BNI', 'Direct Field Visit', 'Other']
const PRODUCT_OPTIONS = ['Solar on Grid', 'Solar off Grid', 'Solar Hybrid', 'Solar Pump Set', 'Solar Water Heater', 'Solar street light', 'E-Vehicle Charger', 'Heat Pump', 'Mega Volt']

export const emptyLeadForm = {
  customerName: '', mobile: '', alternateMobile: '', email: '',
  customerType: 'Residential' as Lead['customerType'],
  address: '', area: '', city: 'Trichy',
  leadSource: 'Walk-in' as LeadSource, sourceReference: '',
  productInterested: '', requirementDescription: '', approximateRequirement: '',
  priority: 'Medium' as Lead['priority'], remarks: '',
  paymentType: 'Own Payment' as Lead['paymentType']
}

export function AddLeadModal({ onClose }: { onClose: () => void }) {
  const { employee } = useAuth()
  const { addLead } = useApp()
  const [form, setForm] = useState(emptyLeadForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submitLead(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerName || !form.mobile || !form.productInterested || !employee) return
    setIsSubmitting(true)
    setError('')
    try {
      await addLead({
        ...form,
        assignedEmployeeId: employee.designation === 'Document Follow-up Executive' ? undefined : employee.id,
        firstContactDate: new Date().toISOString().slice(0, 10),
        status: employee.designation === 'Document Follow-up Executive' ? 'Pending CEO Assignment' : 'New',
      })
      onClose()
    } catch (err: any) {
      const detail = err.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(', '));
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to add lead');
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title="Add New Lead" onClose={onClose} wide>
      {error && <div className="mb-4 bg-rose/10 border border-rose/30 text-rose text-xs rounded-lg px-3 py-2">{error}</div>}
      <form onSubmit={submitLead} className="grid sm:grid-cols-2 gap-4">
        <Field label="Customer Name"><input required className={inputCls} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></Field>
        <Field label="Mobile Number"><input required className={inputCls} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
        <Field label="Alternate Number"><input className={inputCls} value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} /></Field>
        <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Customer Type">
          <select className={inputCls} value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value as Lead['customerType'] })}>
            <option>Residential</option><option>Commercial</option><option>Industrial</option>
          </select>
        </Field>
        <Field label="Payment Type">
          <select required className={inputCls} value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value as Lead['paymentType'] })}>
            <option>Own Payment</option><option>Loan</option>
          </select>
        </Field>
        <Field label="Area / City"><input required className={inputCls} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Thillai Nagar" /></Field>
        <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Lead Source">
          <select className={inputCls} value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value as LeadSource })}>
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        {form.leadSource === 'Other' && (
          <Field label="Source Reference">
            <input className={inputCls} value={form.sourceReference} onChange={(e) => setForm({ ...form, sourceReference: e.target.value })} placeholder="Optional" />
          </Field>
        )}
        <Field label="Product Interested">
          <select required className={inputCls} value={form.productInterested} onChange={(e) => setForm({ ...form, productInterested: e.target.value })}>
            <option value="" disabled>Select a product</option>
            {PRODUCT_OPTIONS.map((product) => <option key={product}>{product}</option>)}
          </select>
        </Field>
        <Field label="Approximate Requirement"><input className={inputCls} value={form.approximateRequirement} onChange={(e) => setForm({ ...form, approximateRequirement: e.target.value })} placeholder="e.g. 5 kW" /></Field>
        <Field label="Priority">
          <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Lead['priority'] })}>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Requirement Description">
            <textarea className={inputCls} rows={3} value={form.requirementDescription} onChange={(e) => setForm({ ...form, requirementDescription: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-xs text-text-dim px-3 py-2" disabled={isSubmitting}>Cancel</button>
          <button type="submit" disabled={isSubmitting} className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
