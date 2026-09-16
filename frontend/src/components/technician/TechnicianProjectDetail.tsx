import { useRef, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Pill, Field, inputCls, Modal } from '../shared/Primitives'
import { formatDate } from '../../lib/utils'
import type { Project, ChecklistItem } from '../../types/models'
import { Camera, Play, CheckCircle2, ClipboardCheck, Wrench, PackageCheck, Star } from 'lucide-react'

const DEFAULT_TOOLS = ['Drill Machine', 'Torque Wrench Set', 'Cable Crimping Tool', 'Multimeter', 'Safety Harness']
const DEFAULT_CHECKLIST = [
  'Panel alignment and mounting secure',
  'DC/AC wiring insulation checked',
  'Earthing continuity verified',
  'Inverter output readings within spec',
  'EB meter and connection point matched',
]

function readFile(file: File, cb: (dataUrl: string) => void) {
  const reader = new FileReader()
  reader.onload = () => { if (typeof reader.result === 'string') cb(reader.result) }
  reader.readAsDataURL(file)
}

export function TechnicianProjectDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  const { employee } = useAuth()
  const {
    fieldWorkLogs, installationCompletions, finalVerifications, customerReviews,
    startWork, addWorkUpdate, submitEndOfDay, completeInstallation, submitFinalVerification, submitCustomerReview,
  } = useApp()

  const log = fieldWorkLogs.find((l) => l.projectId === project.id && !l.endOfDay) ?? fieldWorkLogs.filter((l) => l.projectId === project.id).slice(-1)[0]
  const completion = installationCompletions.find((c) => c.projectId === project.id)
  const verification = finalVerifications.find((v) => v.projectId === project.id)
  const review = customerReviews.find((r) => r.projectId === project.id)

  const [updateStatus, setUpdateStatus] = useState('')
  const [updateRemarks, setUpdateRemarks] = useState('')
  const [eodWork, setEodWork] = useState('')
  const [eodRemaining, setEodRemaining] = useState('')
  const [eodTools, setEodTools] = useState('All tools returned, accounted for')
  const [completionMaterials, setCompletionMaterials] = useState('')
  const [completionUnused, setCompletionUnused] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST.map((label) => ({ label, checked: false })))
  const [ebDetails, setEbDetails] = useState('')
  const [connectionDetails, setConnectionDetails] = useState('')
  const [measurements, setMeasurements] = useState('')
  const [finalRemarks, setFinalRemarks] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComments, setReviewComments] = useState('')
  const [error, setError] = useState('')

  const startPhotoRef = useRef<HTMLInputElement>(null)
  const updatePhotoRef = useRef<HTMLInputElement>(null)
  const eodPhotoRef = useRef<HTMLInputElement>(null)
  const completionPhotoRef = useRef<HTMLInputElement>(null)
  const verificationPhotoRef = useRef<HTMLInputElement>(null)

  const [pendingStartPhoto, setPendingStartPhoto] = useState<string | null>(null)
  const [pendingUpdatePhoto, setPendingUpdatePhoto] = useState<string | null>(null)
  const [pendingEodPhoto, setPendingEodPhoto] = useState<string | null>(null)
  const [pendingCompletionPhotos, setPendingCompletionPhotos] = useState<string[]>([])
  const [pendingVerificationPhotos, setPendingVerificationPhotos] = useState<string[]>([])

  function handleStartWork() {
    if (!employee) return
    startWork({ projectId: project.id, technicianId: employee.id, toolsTaken: DEFAULT_TOOLS, materialsTaken: [project.capacityKw + ' kW system materials as per issue slip'], startingPhoto: pendingStartPhoto ?? 'mock://start-photo.jpg' })
  }

  function submitUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!log) return
    if (!updateStatus.trim()) { setError('Describe the current work status before submitting.'); return }
    addWorkUpdate(log.id, { status: updateStatus.trim(), photos: pendingUpdatePhoto ? [pendingUpdatePhoto] : [], remarks: updateRemarks.trim() || undefined })
    setUpdateStatus('')
    setUpdateRemarks('')
    setPendingUpdatePhoto(null)
  }

  function submitEod(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!log) return
    if (!eodWork.trim()) { setError('Describe what work was completed today.'); return }
    submitEndOfDay(log.id, { workCompleted: eodWork.trim(), remainingWork: eodRemaining.trim() || undefined, toolStatus: eodTools.trim(), sitePhotos: pendingEodPhoto ? [pendingEodPhoto] : [] })
  }

  function submitCompletion(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!employee) return
    if (!completionMaterials.trim()) { setError('List materials consumed before completing installation.'); return }
    if (pendingCompletionPhotos.length === 0) { setError('Add at least one completion photo.'); return }
    completeInstallation({
      projectId: project.id, technicianId: employee.id, materialsConsumed: completionMaterials.trim(),
      unusedMaterials: completionUnused.trim() || undefined, photos: pendingCompletionPhotos, videos: [],
      finalRemarks: undefined,
      unusedItemId: completionUnused.trim() ? 's5' : undefined,
      unusedQuantity: completionUnused.trim() ? 5 : undefined,
    })
  }

  function toggleCheck(i: number) {
    setChecklist((prev) => prev.map((c, idx) => (idx === i ? { ...c, checked: !c.checked } : c)))
  }

  const allConditionsMet = project.installationStatus === 'Completed' && project.balanceAmount === 0 && project.ebStatus === 'Meter Installed' && !!project.documentsCompleted

  function submitVerification(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!employee) return
    if (!allConditionsMet) { setError('All conditions (installation, full payment, EB meter, documents) must be complete first.'); return }
    if (!checklist.every((c) => c.checked)) { setError('Complete every item on the technical checklist.'); return }
    if (!ebDetails.trim() || !connectionDetails.trim()) { setError('EB meter details and connection details are required.'); return }
    submitFinalVerification({
      projectId: project.id, technicianId: employee.id, technicianName: employee.name,
      date: '2026-08-14', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      location: project.site, ebMeterDetails: ebDetails.trim(), connectionDetails: connectionDetails.trim(),
      technicalChecklist: checklist, measurements: measurements.trim(), finalPhotos: pendingVerificationPhotos,
      finalRemarks: finalRemarks.trim() || undefined,
    })
  }

  function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    submitCustomerReview({
      projectId: project.id, customerName: project.customerName, technicianId: employee.id, technicianName: employee.name,
      rating: reviewRating, installationQuality: reviewRating, technicianBehaviour: reviewRating, overallSatisfaction: reviewRating,
      comments: reviewComments.trim() || undefined, customerConfirmation: true,
    })
  }

  return (
    <Modal title={`${project.projectCode} — ${project.customerName}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div className="text-xs text-text-dim">{project.site}</div>
          <Pill status={project.installationStatus} />
        </div>

        {/* Start Work */}
        {!log && project.installationStatus !== 'Completed' && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Start Work</div>
            <div className="text-xs text-text-dim">Tools: {DEFAULT_TOOLS.join(', ')}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => startPhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                <Camera size={13} /> Starting Photo {pendingStartPhoto && <CheckCircle2 size={13} className="text-teal" />}
              </button>
              <input ref={startPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, setPendingStartPhoto); e.target.value = '' }} />
            </div>
            <button onClick={handleStartWork} className="flex items-center gap-1.5 bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors">
              <Play size={13} /> Start Work
            </button>
          </div>
        )}

        {/* During Work — updates */}
        {log && !log.endOfDay && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Field Updates <span className="text-text-dim/70 normal-case">(minimum 1 every 3 hours)</span></div>
            {log.updates.length > 0 && (
              <div className="space-y-1.5">
                {log.updates.map((u, i) => (
                  <div key={i} className="text-xs bg-panel-raised border border-border rounded-lg p-2.5">
                    <div className="flex items-center gap-2 font-medium"><Wrench size={12} className="text-sun" /> {u.time}</div>
                    <div className="mt-0.5">{u.status}</div>
                    {u.remarks && <div className="text-text-dim italic mt-0.5">{u.remarks}</div>}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={submitUpdate} className="space-y-2.5">
              <Field label="Work Status"><input value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)} className={inputCls} placeholder="e.g. Panels 14 of 20 mounted" /></Field>
              <Field label="Remarks / Problems"><textarea value={updateRemarks} onChange={(e) => setUpdateRemarks(e.target.value)} rows={2} className={inputCls} /></Field>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => updatePhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                  <Camera size={13} /> Photo {pendingUpdatePhoto && <CheckCircle2 size={13} className="text-teal" />}
                </button>
                <input ref={updatePhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, setPendingUpdatePhoto); e.target.value = '' }} />
              </div>
              {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" className="bg-teal text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">Log Update</button>
            </form>

            <div className="border-t border-border pt-3 space-y-2.5">
              <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">End of Day</div>
              <form onSubmit={submitEod} className="space-y-2.5">
                <Field label="Work Completed"><textarea value={eodWork} onChange={(e) => setEodWork(e.target.value)} rows={2} className={inputCls} /></Field>
                <Field label="Remaining Work"><textarea value={eodRemaining} onChange={(e) => setEodRemaining(e.target.value)} rows={2} className={inputCls} /></Field>
                <Field label="Tool Status"><input value={eodTools} onChange={(e) => setEodTools(e.target.value)} className={inputCls} /></Field>
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => eodPhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                    <Camera size={13} /> Site Photo {pendingEodPhoto && <CheckCircle2 size={13} className="text-teal" />}
                  </button>
                  <input ref={eodPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, setPendingEodPhoto); e.target.value = '' }} />
                </div>
                <button type="submit" className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors">Submit End of Day</button>
              </form>
            </div>
          </div>
        )}

        {log?.endOfDay && !completion && (
          <div className="border-t border-border pt-4 text-xs text-text-dim">
            End of day submitted on {formatDate(log.endOfDay.submittedOn)}. Continue this session on the next scheduled work day, or complete the installation below once all work is done.
          </div>
        )}

        {/* Installation Completion */}
        {project.installationStatus !== 'Completed' && log && (
          <div className="border-t border-border pt-4 space-y-2.5">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Installation Completion</div>
            <form onSubmit={submitCompletion} className="space-y-2.5">
              <Field label="Materials Consumed"><textarea value={completionMaterials} onChange={(e) => setCompletionMaterials(e.target.value)} rows={2} className={inputCls} placeholder="e.g. 20 Nos Panel 540W, 1 Nos Inverter 5kW..." /></Field>
              <Field label="Unused Materials (returned to Warehouse)"><textarea value={completionUnused} onChange={(e) => setCompletionUnused(e.target.value)} rows={2} className={inputCls} placeholder="Optional — e.g. 5m DC Cable" /></Field>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => completionPhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                  <Camera size={13} /> Final Photos {pendingCompletionPhotos.length > 0 && <CheckCircle2 size={13} className="text-teal" />}
                </button>
                <input ref={completionPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, (d) => setPendingCompletionPhotos((prev) => [...prev, d])); e.target.value = '' }} />
                {pendingCompletionPhotos.length > 0 && <span className="text-xs text-teal">{pendingCompletionPhotos.length} captured</span>}
              </div>
              {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" className="flex items-center gap-1.5 bg-teal text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">
                <PackageCheck size={13} /> Complete Installation
              </button>
            </form>
          </div>
        )}

        {completion && (
          <div className="border-t border-border pt-4 text-xs bg-panel-raised border border-border rounded-lg p-3">
            <div className="text-teal font-medium mb-0.5 flex items-center gap-1.5"><PackageCheck size={13} /> Installation completed {formatDate(completion.completionDate)}</div>
            <div className="text-text-dim">Consumed: {completion.materialsConsumed}</div>
            {completion.unusedMaterials && <div className="text-text-dim">Unused (returned): {completion.unusedMaterials} {completion.materialsReturnedToWarehouse && '✓'}</div>}
          </div>
        )}

        {/* Final Connection / Technical Verification */}
        {project.installationStatus === 'Completed' && !verification && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Final Connection Verification</div>
            {!allConditionsMet && (
              <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">
                Cannot proceed yet — required: installation completed{project.installationStatus === 'Completed' ? ' ✓' : ''}, full payment received{project.balanceAmount === 0 ? ' ✓' : ` (₹${project.balanceAmount.toLocaleString('en-IN')} pending)`}, EB meter installed{project.ebStatus === 'Meter Installed' || project.ebStatus === 'Connected' ? ' ✓' : ` (currently ${project.ebStatus})`}, documents completed{project.documentsCompleted ? ' ✓' : ' (pending)'}.
              </div>
            )}
            <form onSubmit={submitVerification} className="space-y-2.5">
              <div className="space-y-1.5">
                {checklist.map((c, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={c.checked} onChange={() => toggleCheck(i)} className="accent-teal" />
                    {c.label}
                  </label>
                ))}
              </div>
              <Field label="EB Meter Details"><input value={ebDetails} onChange={(e) => setEbDetails(e.target.value)} className={inputCls} placeholder="Meter no., service connection no." /></Field>
              <Field label="Connection Details"><input value={connectionDetails} onChange={(e) => setConnectionDetails(e.target.value)} className={inputCls} placeholder="Solar + EB tie-in point, phase details" /></Field>
              <Field label="Measurements / Readings"><textarea value={measurements} onChange={(e) => setMeasurements(e.target.value)} rows={2} className={inputCls} /></Field>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => verificationPhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                  <Camera size={13} /> Final Photos {pendingVerificationPhotos.length > 0 && <CheckCircle2 size={13} className="text-teal" />}
                </button>
                <input ref={verificationPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, (d) => setPendingVerificationPhotos((prev) => [...prev, d])); e.target.value = '' }} />
              </div>
              <Field label="Issues / Resolution / Remarks"><textarea value={finalRemarks} onChange={(e) => setFinalRemarks(e.target.value)} rows={2} className={inputCls} /></Field>
              {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" disabled={!allConditionsMet} className="flex items-center gap-1.5 bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <ClipboardCheck size={13} /> Submit Final Verification
              </button>
            </form>
          </div>
        )}

        {verification && (
          <div className="border-t border-border pt-4 text-xs bg-panel-raised border border-border rounded-lg p-3">
            <div className="text-teal font-medium mb-0.5 flex items-center gap-1.5"><ClipboardCheck size={13} /> Final verification submitted {formatDate(verification.submittedOn)}</div>
            <div className="text-text-dim">{verification.ebMeterDetails} · {verification.connectionDetails}</div>
          </div>
        )}

        {/* Customer Review */}
        {verification && !review && (
          <div className="border-t border-border pt-4 space-y-2.5">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Customer Review <span className="text-rose normal-case">(mandatory — no manual override)</span></div>
            <form onSubmit={submitReview} className="space-y-2.5">
              <Field label="Overall Rating">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)}>
                      <Star size={20} className={n <= reviewRating ? 'text-sun fill-sun' : 'text-border'} />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Customer Comments"><textarea value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} rows={2} className={inputCls} placeholder="Recorded on behalf of the customer at final visit" /></Field>
              <button type="submit" className="flex items-center gap-1.5 bg-teal text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">
                <CheckCircle2 size={13} /> Submit Review & Close Project
              </button>
            </form>
          </div>
        )}

        {review && (
          <div className="border-t border-border pt-4 text-xs text-teal flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Customer review submitted {formatDate(review.submittedOn)} — project completed.
          </div>
        )}
      </div>
    </Modal>
  )
}
