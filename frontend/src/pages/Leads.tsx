import { useMemo, useState } from 'react'
import { useMarketing } from '../store/MarketingStore'
import { useAuth } from '../auth/AuthContext'
import { Card, SectionHeading, Pill, PriorityDot, Modal, Field, inputCls } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import type { Lead, LeadSource } from '../types/models'
import { formatDate } from '../lib/utils'

const STATUS_OPTIONS = ['All Status', 'Pending CEO Assignment', 'New', 'Contacted', 'Interested', 'Follow-up', 'Site Visit Required', 'Site Visit Scheduled', 'Not Interested', 'Converted']
const LEAD_SOURCES: LeadSource[] = ['Previous Customer', 'Tele Calling', 'Inquiry Call', 'Walk-in', 'Justdial', 'IndiaMART', 'Google Search', 'BNI', 'Direct Field Visit', 'Other']
const PRODUCT_OPTIONS = ['Solar on Grid', 'Solar off Grid', 'Solar Hybrid', 'Solar Pump Set', 'Solar Water Heater', 'Solar street light', 'E-Vehicle Charger', 'Heat Pump', 'Mega Volt']

function productName(productInterested: string) {
  const capacityIndex = productInterested.search(/\s+\d+(?:\.\d+)?\s*kW\b/i)
  return capacityIndex >= 0 ? productInterested.slice(0, capacityIndex).trim() : productInterested
}

function makeEmptyForm(firstAssigneeId: string) {
  return {
    customerName: '', mobile: '', alternateMobile: '', email: '',
    customerType: 'Residential' as Lead['customerType'],
    address: '', area: '', city: 'Trichy',
    leadSource: 'Walk-in' as LeadSource, sourceReference: '',
    productInterested: '', requirementDescription: '', approximateRequirement: '',
    priority: 'Medium' as Lead['priority'], remarks: '',
    paymentType: 'Own Payment' as Lead['paymentType'],
    assignedEmployeeId: firstAssigneeId,
  }
}

export default function Leads() {
  const { employee, employees } = useAuth()
  const marketingEmployees = useMemo(() => employees.filter((e) => e.department === 'Marketing' && e.employmentStatus === 'Active'), [employees])
  const emptyForm = useMemo(() => makeEmptyForm(marketingEmployees[0]?.id ?? ''), [marketingEmployees])
  const { leads, addLead, reassignLead } = useMarketing()
  const [tab, setTab] = useState<'my' | 'all'>('all')
  const [status, setStatus] = useState('All Status')
  const [source, setSource] = useState('All Sources')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [assigningLead, setAssigningLead] = useState<Lead | null>(null)
  const [assignTo, setAssignTo] = useState('')
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const SOURCE_OPTIONS = ['All Sources', ...Array.from(new Set(leads.map((l) => l.leadSource)))]

  const scoped = useMemo(
    () => (tab === 'my' ? leads.filter((l) => l.createdById === employee?.id) : leads),
    [leads, tab, employee],
  )
  const filtered = useMemo(
    () => scoped.filter((l) => (status === 'All Status' || l.status === status) && (source === 'All Sources' || l.leadSource === source)),
    [scoped, status, source],
  )
  const paginatedList = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  async function submitLead(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerName || !form.mobile || !form.productInterested || !employee) return
    setIsSubmitting(true)
    setError('')
    try {
      await addLead({
        ...form,
        firstContactDate: new Date().toISOString().slice(0, 10),
        status: 'New',
        createdById: employee.id,
        customerOrigin: 'New Lead',
      })
      setForm({ ...emptyForm })
      setShowAdd(false)
      setTab('my')
    } catch (err: any) {
      const detail = err.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(', '))
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to add lead')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assigningLead || !assignTo) return
    setIsSubmitting(true)
    setError('')
    try {
      await reassignLead(assigningLead.id, assignTo)
      setAssigningLead(null)
    } catch (err: any) {
      const detail = err.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(', '))
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to reassign lead')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: Column<Lead>[] = [
    { header: 'Customer', cell: (l) => (
      <div>
        <div className="font-medium text-text">{l.customerName}</div>
        <div className="text-xs text-text-dim">{l.mobile} · {l.area}</div>
        {l.paymentType && <div className="text-[10px] text-teal mt-0.5 font-medium uppercase">{l.paymentType}</div>}
      </div>
    ) },
    { header: 'Product', cell: (l) => <span className="text-text-dim">{productName(l.productInterested)}</span> },
    { header: 'Requirement', cell: (l) => <span className="text-text-dim">{l.approximateRequirement}</span> },
    { header: 'Source', cell: (l) => l.leadSource },
    { header: 'Assigned To', cell: (l) => (
      <div className="flex items-center gap-2">
        <span>{employees.find((e) => e.id === l.assignedEmployeeId)?.name ?? '—'}</span>
        <button onClick={(e) => { e.stopPropagation(); setAssigningLead(l); setAssignTo(l.assignedEmployeeId || marketingEmployees[0]?.id || ''); setError('') }} className="text-[10px] text-sun hover:underline">Reassign</button>
      </div>
    ) },
    { header: 'Priority', cell: (l) => <PriorityDot priority={l.priority} /> },
    { header: 'Status', cell: (l) => <Pill status={l.status} /> },
    { header: 'First Contact', cell: (l) => <span className="text-text-dim">{formatDate(l.firstContactDate)}</span> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="CEO Portal"
        title="Leads / Clients"
        action={
          <button onClick={() => { setShowAdd(true); setError(''); setForm(emptyForm) }} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs hover:shadow active:scale-[0.99] cursor-pointer">
            + New Client
          </button>
        }
      />

      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 w-fit">
        <button onClick={() => setTab('my')} className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${tab === 'my' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>My Clients</button>
        <button onClick={() => setTab('all')} className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${tab === 'all' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>All Clients</button>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
          {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/60 ml-auto">{filtered.length} of {scoped.length}</span>
      </Card>

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedList}
          keyFn={(l) => l.id}
          onRowClick={(l) => setActiveLead(l)}
          mobileCard={(l) => (
            <Card className="p-5 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{l.customerName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{l.mobile} · {l.area}</div>
                  {l.paymentType && <div className="text-[10px] text-emerald-700 font-bold uppercase mt-1 inline-block bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">{l.paymentType}</div>}
                </div>
                <Pill status={l.status} />
              </div>
              <div className="text-xs text-slate-600 font-medium">{l.productInterested} · {l.leadSource}</div>
              <div className="text-xs text-slate-500">Assigned: {employees.find((e) => e.id === l.assignedEmployeeId)?.name ?? '—'}</div>
              {l.status === 'Not Interested' && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">Not Interested — {l.lostReason}: {l.lostReasonDetail}</div>
              )}
              <div className="flex gap-3 pt-1 border-t border-slate-100">
                <button onClick={() => { setAssigningLead(l); setAssignTo(l.assignedEmployeeId || marketingEmployees[0]?.id || ''); setError('') }} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">Reassign</button>
              </div>
            </Card>
          )}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
        />
      </div>

      <Card className="p-5">
        <SectionHeading eyebrow="Detail" title="Not Interested reasons" />
        <div className="space-y-2.5">
          {leads.filter((l) => l.status === 'Not Interested').map((l) => (
            <div key={l.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-sm border-t border-[#e2e8e5] pt-3 first:border-t-0 first:pt-0">
              <span className="font-bold text-slate-900 w-44 shrink-0 truncate">{l.customerName}</span>
              <Pill status={l.lostReason ?? 'Other'} />
              <span className="text-slate-500 text-xs flex-1">{l.lostReasonDetail}</span>
            </div>
          ))}
        </div>
      </Card>

      {showAdd && (
        <Modal title="New Client" onClose={() => setShowAdd(false)} wide>
          {error && <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 font-medium">{error}</div>}
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
            <Field label="Assign To Marketing Employee">
              <select className={inputCls} value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
                {marketingEmployees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Requirement Description">
                <textarea className={inputCls} rows={3} value={form.requirementDescription} onChange={(e) => setForm({ ...form, requirementDescription: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowAdd(false)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 cursor-pointer" disabled={isSubmitting}>Cancel</button>
              <button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs hover:shadow active:scale-[0.99] disabled:opacity-50 cursor-pointer">
                {isSubmitting ? 'Saving...' : 'Save Client'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {assigningLead && (
        <Modal title={`Assign — ${assigningLead.customerName}`} onClose={() => setAssigningLead(null)}>
          {error && <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 font-medium">{error}</div>}
          <form onSubmit={submitAssign} className="space-y-4">
            <Field label="Marketing Employee">
              <select className={inputCls} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                {marketingEmployees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setAssigningLead(null)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 cursor-pointer" disabled={isSubmitting}>Cancel</button>
              <button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs hover:shadow active:scale-[0.99] disabled:opacity-50 cursor-pointer">
                {isSubmitting ? 'Assigning...' : 'Assign Lead'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {activeLead && (
        <Modal title={`Client Details — ${activeLead.customerName}`} onClose={() => setActiveLead(null)}>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold text-slate-500 mb-1">Customer</div>
                <div className="font-bold text-slate-900">{activeLead.customerName}</div>
                <div className="text-slate-600">{activeLead.mobile} {activeLead.alternateMobile ? `/ ${activeLead.alternateMobile}` : ''}</div>
              </div>
              <div>
                <div className="font-semibold text-slate-500 mb-1">Status & Priority</div>
                <div className="flex items-center gap-2">
                  <Pill status={activeLead.status} />
                  <PriorityDot priority={activeLead.priority} />
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-500 mb-1">Product Interested</div>
                <div className="text-slate-900">{activeLead.productInterested}</div>
                <div className="text-slate-600">{activeLead.approximateRequirement}</div>
              </div>
              <div>
                <div className="font-semibold text-slate-500 mb-1">Location</div>
                <div className="text-slate-900">{activeLead.area}, {activeLead.city}</div>
                {activeLead.address && <div className="text-slate-600 text-xs mt-0.5">{activeLead.address}</div>}
              </div>
              {activeLead.requirementDescription && (
                <div className="sm:col-span-2">
                  <div className="font-semibold text-slate-500 mb-1">Requirement Description</div>
                  <div className="text-slate-900 whitespace-pre-wrap">{activeLead.requirementDescription}</div>
                </div>
              )}
              {activeLead.remarks && (
                <div className="sm:col-span-2">
                  <div className="font-semibold text-emerald-800 mb-2">Marketing Notes / Remarks</div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                    {activeLead.remarks.split(/\n\n+/).map((note, idx) => (
                      <div key={idx} className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 shadow-sm">
                        <div className="text-emerald-950 italic whitespace-pre-wrap">{note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setActiveLead(null)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">Close</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
