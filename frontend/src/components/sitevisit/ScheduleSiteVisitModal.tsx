import { useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Field, inputCls, Modal } from '../shared/Primitives'
import type { SiteType } from '../../types/models'

const SITE_TYPES: SiteType[] = ['Rooftop - RCC', 'Rooftop - Sheet', 'Ground Mount', 'Industrial Shed', 'Other']

export function ScheduleSiteVisitModal({ onClose, initialLeadId }: { onClose: () => void; initialLeadId?: string }) {
  const { leads, siteVisits, scheduleSiteVisit } = useApp()
  const { employee, employees } = useAuth()
  const [leadId, setLeadId] = useState(initialLeadId || '')
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [visitTime, setVisitTime] = useState('')
  const [siteType, setSiteType] = useState<SiteType>('Rooftop - RCC')

  const [error, setError] = useState('')

  const eligibleLeads = leads.filter(
    (l) =>
      l.status === 'Site Visit Required' &&
      !siteVisits.some((v) => v.leadId === l.id && (v.status === 'Upcoming' || v.status === 'In Progress' || v.status === 'Completed')),
  )

  const selectedLeadObj = eligibleLeads.find((l) => l.id === leadId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const lead = eligibleLeads.find((l) => l.id === leadId)
    if (!lead) { setError('Select a lead / customer.'); return }
    if (!assignedEmployeeId) { setError('Select a site visitor to assign to.'); return }
    if (!visitDate || !visitTime) { setError('Visit date and time are required.'); return }
    if (!employee) return
    const assignedEmp = employees.find(e => e.id === assignedEmployeeId)
    if (!assignedEmp) return


    try {
      await scheduleSiteVisit({
        leadId: lead.id,
        customerName: lead.customerName,
        customerMobile: lead.mobile,
        siteAddress: lead.address || '',
        area: lead.area || '',
        customerLatitude: undefined,
        customerLongitude: undefined,
        visitDate,
        visitTime,
        employeeId: assignedEmp.id,
        employeeName: assignedEmp.name,
        siteType,
      })
      onClose()
    } catch (err: any) {
      const detail = err.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(', '))
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to schedule site visit')
      }
    }
  }

  return (
    <Modal title="Schedule Site Visit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Lead / Customer">
          <select className={inputCls} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">— Select a lead —</option>
            {eligibleLeads.map((l) => <option key={l.id} value={l.id}>{l.customerName} — {l.area}</option>)}
          </select>
        </Field>
        {eligibleLeads.length === 0 && <div className="text-xs text-text-dim">No leads are currently awaiting a site visit.</div>}
        <Field label="Assign To (Site Visitor)">
          <select className={inputCls} value={assignedEmployeeId} onChange={(e) => setAssignedEmployeeId(e.target.value)}>
            <option value="">— Select —</option>
            {employees.filter(e => (e.department === 'Site Visit' || e.designation === 'Site Visitor') && e.employmentStatus === 'Active').map(e => {
              const isWorking = siteVisits.some(v => v.employeeId === e.id && ['Upcoming', 'In Progress', 'Revisit Required'].includes(v.status))
              const statusDot = isWorking ? '🔴 (Working)' : '🟢 (Free)'
              return (
                <option key={e.id} value={e.id} disabled={isWorking}>{statusDot} {e.name} ({e.designation})</option>
              )
            })}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visit Date"><input type="date" className={inputCls} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} /></Field>
          <Field label="Visit Time"><input type="time" className={inputCls} value={visitTime} onChange={(e) => setVisitTime(e.target.value)} /></Field>
        </div>
        <Field label="Site Type">
          <select className={inputCls} value={siteType} onChange={(e) => setSiteType(e.target.value as SiteType)}>
            {SITE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {selectedLeadObj && (
          <div className="bg-black/[0.02] border border-border p-3 rounded-lg text-sm space-y-1">
            <div className="text-xs text-text-dim">Customer Address</div>
            <div className="font-medium">{selectedLeadObj.address || 'No address provided'}</div>
            {selectedLeadObj.area && <div className="text-xs text-text-dim">{selectedLeadObj.area}</div>}
          </div>
        )}
        {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-xs text-text-dim px-3 py-2">Cancel</button>
          <button type="submit" className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors">Schedule Visit</button>
        </div>
      </form>
    </Modal>
  )
}
