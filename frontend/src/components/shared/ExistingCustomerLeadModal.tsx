import { useState } from 'react'
import { Modal, Field, inputCls } from './Primitives'
import { useMarketing } from '../../store/MarketingStore'
import type { Lead } from '../../types/models'

export function ExistingCustomerLeadModal({
  customer,
  assignedEmployeeId,
  onClose,
  onCreated,
}: {
  customer: any
  assignedEmployeeId: string
  onClose: () => void
  onCreated?: (lead: Lead) => void
}) {
  const { addExistingCustomerLead } = useMarketing()
  const [productInterested, setProductInterested] = useState('')
  const [requirementDescription, setRequirementDescription] = useState('')
  const [approximateRequirement, setApproximateRequirement] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!productInterested) return
    setIsSubmitting(true)
    setError('')
    try {
      const lead = await addExistingCustomerLead({
        customerId: customer.customerId,
        priorProjectId: customer.completedProjectId,
        productInterested,
        requirementDescription,
        approximateRequirement,
        priority: 'Medium',
        assignedEmployeeId,
      })
      onCreated?.(lead)
      onClose()
    } catch (err: any) {
      const detail = err.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(', '))
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to create lead')
      }
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <Modal title={`New Enquiry — ${customer.customerName}`} onClose={onClose}>
      {error && <div className="mb-4 bg-rose/10 border border-rose/30 text-rose text-xs rounded-lg px-3 py-2">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="text-xs text-text-dim bg-panel-raised border border-border rounded-lg px-3 py-2">
          Existing customer, completed project <span className="font-medium text-text">{customer.completedProjectCode}</span> ({customer.capacityKw} kW). This creates a fresh lead for their new requirement — it will not affect the completed project record.
        </div>
        <Field label="Product / Requirement Interested">
          <input required className={inputCls} value={productInterested} onChange={(e) => setProductInterested(e.target.value)} placeholder="e.g. Battery Backup Add-on, 5kWh" />
        </Field>
        <Field label="Approximate Requirement">
          <input className={inputCls} value={approximateRequirement} onChange={(e) => setApproximateRequirement(e.target.value)} placeholder="e.g. 5 kWh battery" />
        </Field>
        <Field label="Notes">
          <textarea className={inputCls} rows={3} value={requirementDescription} onChange={(e) => setRequirementDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-xs text-text-dim px-3 py-2" disabled={isSubmitting}>Cancel</button>
          <button type="submit" disabled={isSubmitting} className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create Lead'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
