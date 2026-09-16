import { useState, useEffect, type ReactNode } from 'react'
import { X, MapPin, Phone, AlertTriangle, Camera, Download } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Pill, Field, inputCls, MultiSelect } from '../shared/Primitives'
import { StageArc } from '../shared/StageArc'
import { formatINR, formatDate } from '../../lib/utils'
import type { Project, Quotation } from '../../types/models'
import { quotationsApi } from '../../api/quotations'
import { projectsApi } from '../../api/projects'

function imgUrl(src: string) {
  if (!src) return ''
  if (src.startsWith('/uploads')) return `http://localhost:8000${src}`
  return src
}

function EvidenceItem({ src, label }: { src: string, label?: string }) {
  const url = imgUrl(src)
  return (
    <a href={url} target="_blank" rel="noreferrer" title={label}
      className="group relative block w-14 h-14 rounded-lg overflow-hidden border border-border bg-black/[0.02] shrink-0">
      <img src={url} alt="Evidence" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        <Download size={14} />
      </div>
    </a>
  )
}

export function ProjectDetailDrawer({ project, onClose }: { project: Project; onClose: () => void }) {
  const {
    escalateProject, putProjectOnHold, resumeProject, addProjectInstruction, requestStock, flagStockShortage,
    recordProjectIssue, resolveProjectIssue, projectIssues, stockRequests, stockItems,
    cancelStockRequest, projects, refreshProjects, scheduleSiteVisit, siteVisits
  } = useApp()
  const { employee, employees } = useAuth()

  const [techId, setTechId] = useState(project.assignedTechnicianId ?? '')
  const [docId, setDocId] = useState(project.assignedDocEmployeeId ?? '')
  const [holdReason, setHoldReason] = useState('')
  const [instruction, setInstruction] = useState('')
  const [escalationNote, setEscalationNote] = useState('')
  const [issueDesc, setIssueDesc] = useState('')
  const [stockItemId, setStockItemId] = useState(stockItems[0]?.id ?? '')
  const [stockQty, setStockQty] = useState('1')
  const [showShortage, setShowShortage] = useState(false)
  const [isAssigningTech, setIsAssigningTech] = useState(false)
  const [isAssigningDoc, setIsAssigningDoc] = useState(false)
  
  const [additionalTechIds, setAdditionalTechIds] = useState<string[]>([])
  const [additionalDocIds, setAdditionalDocIds] = useState<string[]>([])
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  
  const [finalReviewTechId, setFinalReviewTechId] = useState('')
  const [isAssigningFinal, setIsAssigningFinal] = useState(false)

  useEffect(() => {
    if (project.quotationId) {
      quotationsApi.getById(project.quotationId).then(setQuotation).catch(console.error)
    }
  }, [project.quotationId])
  
  // Sync state with assignments
  useEffect(() => {
    if (project.assignments) {
      setAdditionalTechIds(project.assignments.filter(a => a.role === 'Technician' && a.assignmentType === 'Additional').map(a => a.employeeId))
      setAdditionalDocIds(project.assignments.filter(a => a.role === 'Follow-Up' && a.assignmentType === 'Additional').map(a => a.employeeId))
    }
  }, [project.assignments])

  useEffect(() => {
    if (!stockItemId && stockItems.length > 0) {
      setStockItemId(stockItems[0].id)
    }
  }, [stockItems, stockItemId])

  // Keep local state in sync if project updates globally
  const currentProject = projects.find(p => p.id === project.id) || project

  const technicians = employees.filter((e) => e.designation === 'Field Technician' && e.employmentStatus === 'Active')
  const docEmployees = employees.filter((e) => e.designation === 'Document Follow-up Executive' && e.employmentStatus === 'Active')
  const myIssues = projectIssues.filter((i) => i.projectId === project.id)
  const myStock = stockRequests.filter((r) => r.projectId === project.id)
  
  const activeStock = myStock.filter(r => r.status !== 'Cancelled' && r.status !== 'Returned')
  const isStockReady = (project.warehouseStatus === 'Reserved' || project.warehouseStatus === 'Issued') && 
                       (activeStock.length === 0 || activeStock.every(r => r.status === 'Reserved' || r.status === 'Issued'))

  const conditionsMet = project.installationStatus === 'Completed' && project.balanceAmount === 0 && (project.ebStatus === 'Meter Installed' || project.ebStatus === 'Connected')

  async function handleAssignTech() {
    if (!techId) return
    setIsAssigningTech(true)
    try {
      await projectsApi.assign(project.id, {
        assignedTechnicianId: techId,
        additionalTechnicianIds: additionalTechIds,
        assignedDocEmployeeId: project.assignedDocEmployeeId,
        additionalDocEmployeeIds: additionalDocIds
      })
      refreshProjects()
      alert('Technician assigned successfully!')
    } catch (err: any) {
      alert(`Failed to assign technician: ${err.message || 'Unknown error'}`)
    } finally {
      setIsAssigningTech(false)
    }
  }
  async function handleAssignDoc() {
    if (!docId) return
    setIsAssigningDoc(true)
    try {
      await projectsApi.assign(project.id, {
        assignedTechnicianId: project.assignedTechnicianId,
        additionalTechnicianIds: additionalTechIds,
        assignedDocEmployeeId: docId,
        additionalDocEmployeeIds: additionalDocIds
      })
      refreshProjects()
      alert('Document employee assigned successfully!')
    } catch (err: any) {
      alert(`Failed to assign document employee: ${err.message || 'Unknown error'}`)
    } finally {
      setIsAssigningDoc(false)
    }
  }
  function handleHold() {
    if (!holdReason.trim()) return
    putProjectOnHold(project.id, holdReason.trim())
    setHoldReason('')
  }
  function handleInstruction() {
    if (!instruction.trim() || !employee) return
    addProjectInstruction(project.id, instruction.trim(), employee.name)
    setInstruction('')
  }
  function handleEscalate() {
    if (!escalationNote.trim()) return
    escalateProject(project.id, escalationNote.trim())
    setEscalationNote('')
  }
  function handleIssue() {
    if (!issueDesc.trim() || !employee) return
    recordProjectIssue({ projectId: project.id, projectCode: project.projectCode, raisedBy: employee.name, raisedOn: new Date().toISOString().slice(0, 10), description: issueDesc.trim() })
    setIssueDesc('')
  }
  
  async function handleAssignFinalReview() {
    if (!finalReviewTechId || !employee) return
    setIsAssigningFinal(true)
    try {
      const selectedTech = technicians.find(t => t.id === finalReviewTechId)
      await scheduleSiteVisit({
        projectId: project.id,
        customerName: project.customerName,
        customerMobile: project.customerMobile,
        siteAddress: project.site || '',
        area: project.area || '',
        visitDate: new Date().toISOString().slice(0, 10),
        visitTime: '09:00',
        employeeId: selectedTech?.id,
        employeeName: selectedTech?.name,
        siteType: 'Final Review'
      })
      alert('Final Review assigned successfully!')
    } catch (err: any) {
      alert(`Failed to assign final review: ${err.message || 'Unknown error'}`)
    } finally {
      setIsAssigningFinal(false)
    }
  }

  function handleStockRequest() {
    if (!employee || !stockItemId) return
    const item = stockItems.find((s) => s.id === stockItemId)
    if (!item) return
    requestStock({ projectId: project.id, projectCode: project.projectCode, itemName: item.productName, stockItemId: item.id, requiredQuantity: Number(stockQty) || 1, unit: item.unit, requestedBy: employee.name, requestedOn: new Date().toISOString().slice(0, 10) })
  }
  function handleFlagShortage() {
    if (!employee || !stockItemId) return
    const item = stockItems.find((s) => s.id === stockItemId)
    if (!item) return
    flagStockShortage({ projectId: project.id, projectCode: project.projectCode, itemName: item.productName, stockItemId: item.id, requiredQuantity: Number(stockQty) || 1, unit: item.unit, requestedBy: employee.name, requestedOn: new Date().toISOString().slice(0, 10), notes: 'Flagged by Project Head — stock shortage, no auto-purchase workflow yet.' })
    setShowShortage(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-panel border-l border-border h-full overflow-y-auto p-5 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-sun font-semibold">{project.projectCode}</div>
            <h3 className="text-xl font-display font-semibold">{project.customerName}</h3>
            <div className="text-xs text-text-dim flex items-center gap-1 mt-1"><MapPin size={12} /> {project.site}</div>
            <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><Phone size={12} /> {project.customerMobile}</div>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text"><X size={20} /></button>
        </div>

        <div className="flex justify-center py-3 bg-panel-raised rounded-xl border border-border">
          <StageArc stage={project.currentStage} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Pill status={project.status} />
          {project.escalated && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose bg-rose/10 border border-rose/30 rounded-full px-2 py-0.5"><AlertTriangle size={11} /> Escalated</span>}
          {conditionsMet && project.currentStage !== 'Completed' && (
            <span className="text-[11px] font-medium text-teal bg-teal/10 border border-teal/30 rounded-full px-2 py-0.5">Ready for Final Connection</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Project Value" value={formatINR(project.projectValue)} />
          <Info label="Balance Due" value={formatINR(project.balanceAmount)} />
          <Info label="Capacity" value={`${project.capacityKw} kW`} />
          <Info label="Warehouse" value={project.warehouseStatus} />
          <Info label="EB Status" value={project.ebStatus} />
          <Info label="Installation" value={project.installationStatus} />
          <Info label="Due Date" value={formatDate(project.dueDate)} />
          <Info label="Priority" value={project.priority} />
        </div>

        {project.holdReason && (
          <div className="text-xs bg-text-dim/10 border border-border rounded-lg p-3">
            <span className="font-medium">On Hold:</span> {project.holdReason}
            <button onClick={() => resumeProject(project.id)} className="ml-2 text-teal underline">Resume</button>
          </div>
        )}

        {/* Technician Evidence */}
        {currentProject.uploads && currentProject.uploads.length > 0 && (
          <Section title={<span className="flex items-center gap-1.5"><Camera size={14} /> Technician Uploads</span>}>
            <div className="flex overflow-x-auto pb-2 gap-4 snap-x hide-scrollbar">
              {currentProject.uploads.map((up) => {
                const uploader = employees.find(e => e.id === up.employeeId)
                return (
                  <div key={up.id} className="space-y-1.5 shrink-0 snap-start max-w-[80px]">
                    <div className="text-[10px] uppercase text-text-dim font-bold flex flex-col gap-1">
                      {up.stage ? <span className="truncate">{up.stage}</span> : null}
                    </div>
                    <EvidenceItem src={up.fileUrl} label={up.fileType} />
                    <div className="text-[9px] text-text-dim truncate" title={uploader?.name}>{uploader?.name}</div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {quotation && (
          <Section title="Approved Quotation Details">
             <div className="space-y-2">
                <div className="bg-panel-raised border border-border rounded-lg p-3 text-sm">
                  <div className="flex justify-between border-b border-border pb-2 mb-2">
                    <span className="font-semibold">{quotation.quotationNumber}</span>
                    <span className="text-text-dim">{formatDate(quotation.date)}</span>
                  </div>
                  {(quotation.solarPanel || quotation.solarInverter) && (
                    <div className="space-y-1 border-b border-border pb-2 mb-2">
                      {quotation.solarPanel && (
                        <div className="text-xs text-text-dim">
                          <span className="font-medium text-text">Solar Panel Brand:</span> {quotation.solarPanel}
                        </div>
                      )}
                      {quotation.solarInverter && (
                        <div className="text-xs text-text-dim">
                          <span className="font-medium text-text">Solar Inverter Brand:</span> {quotation.solarInverter}
                        </div>
                      )}
                    </div>
                  )}
                  {quotation.lineItems && quotation.lineItems.length > 0 ? (
                    <div className="space-y-3">
                      {quotation.lineItems.map((item, idx) => (
                        <div key={item.id}>
                          {idx > 0 && <div className="border-t border-border my-2" />}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-medium text-text">Product: {item.product}</span>
                              <span className="font-medium">{item.quantity} {item.unit}</span>
                            </div>
                            {item.brand && (
                              <div className="text-xs text-text-dim">
                                Brand: {item.brand}
                              </div>
                            )}
                            <div className="text-xs text-text-dim">
                              <span className="block">Product Description:</span>
                              <span className="whitespace-pre-wrap">{item.description || '—'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-text-dim">No line items in quotation.</div>
                  )}
                </div>
             </div>
          </Section>
        )}

        <Section title="Stock Request">
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} className={inputCls}>
                {stockItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.productName}{s.model ? ` (${s.model})` : ''}{s.category ? ` · ${s.category}` : ''}
                  </option>
                ))}
              </select>
              <input type="number" min={1} value={stockQty} onChange={(e) => setStockQty(e.target.value)} className={`${inputCls} w-20`} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleStockRequest} className="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20 transition-colors">Request Stock</button>
              <button onClick={() => setShowShortage(true)} className="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20 transition-colors">Flag Shortage</button>
            </div>
            {showShortage && (
              <div className="flex gap-2 items-center bg-rose/5 border border-rose/20 rounded-lg p-2">
                <span className="text-[11px] text-rose flex-1">Confirm flagging {stockItems.find(s => s.id === stockItemId)?.productName || 'selected item'} as a shortage for this project?</span>
                <button onClick={handleFlagShortage} className="text-[11px] font-semibold px-2 py-1 rounded bg-rose text-white">Confirm</button>
              </div>
            )}
          </div>
          {myStock.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {myStock.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-text-dim flex items-center gap-2">
                    {r.status === 'Requested' && (
                      <button 
                        onClick={() => cancelStockRequest(r.id)} 
                        className="text-text-dim hover:text-rose transition-colors p-1 -ml-1 rounded hover:bg-rose/10"
                        title="Cancel Request"
                      >
                        <X size={12} />
                      </button>
                    )}
                    {r.itemName} × {r.quantity ?? r.requiredQuantity} {r.unit}
                  </span>
                  <Pill status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Assign Technician">
          {isStockReady ? (
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2">
                <select value={techId} onChange={(e) => setTechId(e.target.value)} className={inputCls}>
                  <option value="">Select primary technician…</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.location ?? 'Base'}</option>)}
                </select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Additional Technicians</label>
                <MultiSelect 
                  options={technicians.map(t => ({ id: t.id, label: `${t.name} — ${t.location ?? 'Base'}` }))}
                  selectedIds={additionalTechIds}
                  onChange={setAdditionalTechIds}
                  placeholder="Select additional technician..."
                />
              </div>
              
              <button onClick={handleAssignTech} disabled={isAssigningTech} className="text-xs font-medium px-3 py-2 rounded-lg bg-sun/10 text-sun border border-sun/30 hover:bg-sun/20 transition-colors whitespace-nowrap">
                {isAssigningTech ? 'Assigning...' : 'Save Technician Assignment'}
              </button>
            </div>
          ) : (
            <div className="text-xs text-rose bg-rose/5 border border-rose/20 rounded-lg p-2.5">
              All requested products must be fully reserved by the Warehouse before project members can be assigned.
            </div>
          )}
        </Section>

        <Section title="Assign Document Follow-up">
          {isStockReady ? (
            <div className="flex gap-2 flex-col">
              <div className="flex gap-2">
                <select value={docId} onChange={(e) => setDocId(e.target.value)} className={inputCls}>
                  <option value="">Select primary employee…</option>
                  {docEmployees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Additional Follow-up Employees</label>
                <MultiSelect 
                  options={docEmployees.map(t => ({ id: t.id, label: t.name }))}
                  selectedIds={additionalDocIds}
                  onChange={setAdditionalDocIds}
                  placeholder="Select additional follow-up..."
                />
              </div>
              
              <button onClick={handleAssignDoc} disabled={isAssigningDoc} className="text-xs font-medium px-3 py-2 rounded-lg bg-sun/10 text-sun border border-sun/30 hover:bg-sun/20 transition-colors whitespace-nowrap">
                {isAssigningDoc ? 'Assigning...' : 'Save Document Assignment'}
              </button>
            </div>
          ) : (
            <div className="text-xs text-rose bg-rose/5 border border-rose/20 rounded-lg p-2.5">
              All requested products must be fully reserved by the Warehouse before project members can be assigned.
            </div>
          )}
        </Section>

        <Section title="Give Instructions">
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} className={inputCls} placeholder="Instructions for field/document team…" />
          <button onClick={handleInstruction} className="mt-2 text-xs font-medium px-3 py-2 rounded-lg bg-sun/10 text-sun border border-sun/30 hover:bg-sun/20 transition-colors">Log Instruction</button>
          {project.instructionNotes && project.instructionNotes.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {project.instructionNotes.map((n, i) => (
                <div key={i} className="text-xs bg-panel-raised border border-border rounded-lg p-2">
                  <span className="text-text-dim">{formatDate(n.date)} · {n.by}</span>
                  <div className="mt-0.5">{n.note}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {conditionsMet && (
          <Section title="Assign Final Review">
            <div className="flex gap-2 flex-col bg-teal/5 border border-teal/20 rounded-lg p-3">
              <div className="text-xs text-text mb-1">
                Project installation, payment, and EB are complete. You can now assign a technician to do a final site review and collect customer feedback.
              </div>
              <div className="flex gap-2">
                <select value={finalReviewTechId} onChange={(e) => setFinalReviewTechId(e.target.value)} className={inputCls}>
                  <option value="">Select technician…</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.location ?? 'Base'}</option>)}
                </select>
              </div>
              <button onClick={handleAssignFinalReview} disabled={isAssigningFinal || !finalReviewTechId} className="text-xs font-medium px-3 py-2 rounded-lg bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20 transition-colors whitespace-nowrap disabled:opacity-50">
                {isAssigningFinal ? 'Assigning...' : 'Schedule Final Review'}
              </button>
            </div>
          </Section>
        )}

        <Section title="Project Issues">
          <textarea value={issueDesc} onChange={(e) => setIssueDesc(e.target.value)} rows={2} className={inputCls} placeholder="Describe the issue…" />
          <button onClick={handleIssue} className="mt-2 text-xs font-medium px-3 py-2 rounded-lg bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20 transition-colors">Record Issue</button>
          {myIssues.length > 0 && (
            <div className="mt-2.5 space-y-2">
              {myIssues.map((i) => (
                <div key={i.id} className="text-xs bg-panel-raised border border-border rounded-lg p-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <span>{i.description}</span>
                    <Pill status={i.status === 'Open' ? 'Issue Raised' : 'Completed'} />
                  </div>
                  <div className="text-text-dim mt-1">{i.raisedBy} · {formatDate(i.raisedOn)}</div>
                  {i.status === 'Open' ? (
                    <ResolveIssueInline onResolve={(notes) => resolveProjectIssue(i.id, notes)} />
                  ) : (
                    i.resolutionNotes && <div className="mt-1 italic text-teal">Resolved: {i.resolutionNotes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Put On Hold / Escalate">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} className={inputCls} placeholder="Reason to put on hold" />
              <button onClick={handleHold} className="text-xs font-medium px-3 py-2 rounded-lg border border-border text-text-dim hover:text-text transition-colors whitespace-nowrap">Hold</button>
            </div>
            <div className="flex gap-2">
              <input value={escalationNote} onChange={(e) => setEscalationNote(e.target.value)} className={inputCls} placeholder="Escalation note to CEO" />
              <button onClick={handleEscalate} className="text-xs font-medium px-3 py-2 rounded-lg bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20 transition-colors whitespace-nowrap">Escalate</button>
            </div>
          </div>
        </Section>
        
        {siteVisits.filter(v => v.projectId === project.id && v.siteType === 'Final Review' && v.submittedAt).length > 0 && (
          <Section title="Customer Feedback (Final Review)">
            <div className="space-y-3">
              {siteVisits.filter(v => v.projectId === project.id && v.siteType === 'Final Review' && v.submittedAt).map((v) => (
                <div key={v.id} className="bg-teal/5 border border-teal/20 rounded-lg p-3 shadow-sm">
                  <div className="text-xs text-text-dim flex justify-between mb-2 border-b border-teal/10 pb-2">
                    <span className="font-medium text-teal">Collected by {v.employeeName}</span>
                    <span>{formatDate(v.submittedAt!)}</span>
                  </div>
                  {v.notes && (
                    <div className="text-sm font-medium text-text whitespace-pre-wrap mb-3 italic bg-white/50 p-2 rounded border border-border">
                      "{v.notes.replace('Customer Feedback: ', '')}"
                    </div>
                  )}
                  <div className="flex gap-4 mt-2">
                    {v.toolPhotoBefore && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-text-dim font-bold">Before Picture</div>
                        <EvidenceItem src={v.toolPhotoBefore} label="Before Work" />
                      </div>
                    )}
                    {v.toolPhotoAfter && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-text-dim font-bold">After Picture</div>
                        <EvidenceItem src={v.toolPhotoAfter} label="After Work" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}


      </div>
    </div>
  )
}

function ResolveIssueInline({ onResolve }: { onResolve: (notes: string) => void }) {
  const [notes, setNotes] = useState('')
  const [open, setOpen] = useState(false)
  if (!open) {
    return <button onClick={() => setOpen(true)} className="mt-1.5 text-[11px] font-medium text-teal underline">Mark resolved</button>
  }
  return (
    <div className="mt-1.5 flex gap-1.5">
      <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} py-1`} placeholder="Resolution notes" />
      <button onClick={() => notes.trim() && onResolve(notes.trim())} className="text-[11px] font-semibold px-2 rounded bg-teal text-white whitespace-nowrap">Save</button>
    </div>
  )
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Field label={title}>{children}</Field>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel-raised border border-border rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-text-dim mb-0.5">{label}</div>
      <div className="font-medium text-text">{value}</div>
    </div>
  )
}
