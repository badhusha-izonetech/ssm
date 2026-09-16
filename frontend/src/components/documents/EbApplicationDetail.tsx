import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppStore'
import { Pill, Field, inputCls, Modal } from '../shared/Primitives'
import { formatDate } from '../../lib/utils'
import type { EbApplication, EbStageHistory } from '../../types/models'
import { ebApplicationsApi } from '../../api/ebApplications'
import { CheckCircle2, FileCheck, Send, ClipboardCheck, LayoutDashboard, Truck, Upload, File as FileIcon } from 'lucide-react'

export function EbApplicationDetail({ application, onClose }: { application: EbApplication; onClose: () => void }) {
  const { verifyEbDocuments, submitEbPortal, handoverEbApplication, uploadEbDocument } = useApp()

  const [history, setHistory] = useState<EbStageHistory[]>([])
  const [loading, setLoading] = useState(false)

  // Document Upload Form
  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState('')
  const [docRemarks, setDocRemarks] = useState('')
  const [file, setFile] = useState<File | null>(null)

  // Verification Form
  const [verifyStatus, setVerifyStatus] = useState<'VERIFIED' | 'NOT_VERIFIED'>('VERIFIED')
  const [verifyReason, setVerifyReason] = useState('')

  // Portal Form
  const [portalRef, setPortalRef] = useState('')
  const [portalRemarks, setPortalRemarks] = useState('')

  // Handover Form
  const [meterDetails, setMeterDetails] = useState('')
  const [handoverRemarks, setHandoverRemarks] = useState('')

  const [error, setError] = useState('')

  useEffect(() => {
    ebApplicationsApi.getHistory(application.id).then(setHistory).catch(console.error)
  }, [application.id])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!file || !docType.trim()) {
      setError('Please select a file and provide a document type.')
      return
    }
    setLoading(true)
    try {
      await uploadEbDocument(application.id, file, docType, docRemarks)
      setFile(null)
      setDocType('')
      setDocRemarks('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (application.documents.length === 0) {
      setError('Cannot verify without collecting documents first.')
      return
    }
    if (verifyStatus === 'NOT_VERIFIED' && !verifyReason.trim()) {
      setError('Reason is mandatory for NOT VERIFIED.')
      return
    }
    setLoading(true)
    try {
      await verifyEbDocuments(application.id, verifyStatus, verifyReason)
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handlePortalSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await submitEbPortal(application.id, portalRef, portalRemarks)
    } catch (err: any) {
      setError(err.message || 'Portal submission failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleHandover(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await handoverEbApplication(application.id, meterDetails, handoverRemarks)
    } catch (err: any) {
      setError(err.message || 'Handover failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`EB Application — ${application.customerName}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium text-text">{application.projectCode}</div>
            <div className="text-xs text-text-dim mt-0.5">{application.projectDetails}</div>
            {application.customerMobile && <div className="text-xs text-text-dim mt-0.5">{application.customerMobile}</div>}
          </div>
          <Pill status={application.currentStage} />
        </div>

        {/* Document Collection Section */}
        {application.verificationStatus !== 'VERIFIED' && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Document Collection</div>
            <form onSubmit={handleUpload} className="space-y-2.5 bg-panel-raised border border-border p-3 rounded-lg">
              <Field label="Document Type">
                <input required value={docType} onChange={e => setDocType(e.target.value)} className={inputCls} placeholder="e.g. Aadhar Card, Ownership Doc" />
              </Field>
              <Field label="File">
                <input required type="file" ref={fileRef} onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs text-text-dim file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-sun/10 file:text-sun file:text-xs file:font-medium hover:file:bg-sun/20 cursor-pointer" />
              </Field>
              <Field label="Remarks (Optional)">
                <input value={docRemarks} onChange={e => setDocRemarks(e.target.value)} className={inputCls} placeholder="Any notes about this document..." />
              </Field>
              {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
              <button disabled={loading} type="submit" className="flex items-center gap-1.5 bg-panel text-text text-xs font-medium px-4 py-1.5 rounded-lg border border-border hover:bg-black/[0.03] transition-all">
                <Upload size={13} /> {loading ? 'Uploading...' : 'Upload Document'}
              </button>
            </form>
          </div>
        )}

        {/* Uploaded Documents List */}
        {application.documents.length > 0 && (
          <div className="border-t border-border pt-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Collected Documents</div>
            <div className="space-y-2">
              {application.documents.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-panel-raised border border-border p-2.5 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <FileIcon size={14} className="text-sun" />
                    <div>
                      <div className="text-xs font-medium text-text">{d.documentType}</div>
                      <div className="text-[10px] text-text-dim">Uploaded {formatDate(d.createdAt)}</div>
                      {d.remarks && <div className="text-[10px] text-text-dim italic mt-0.5">{d.remarks}</div>}
                    </div>
                  </div>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-sun hover:underline">View</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Section */}
        {application.documents.length > 0 && application.verificationStatus !== 'VERIFIED' && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Document Verification</div>
            <form onSubmit={handleVerify} className="space-y-2.5">
              <Field label="Verification Status">
                <select value={verifyStatus} onChange={e => setVerifyStatus(e.target.value as any)} className={inputCls}>
                  <option value="VERIFIED">VERIFIED (All documents correct)</option>
                  <option value="NOT_VERIFIED">NOT VERIFIED (Issue found)</option>
                </select>
              </Field>
              {verifyStatus === 'NOT_VERIFIED' && (
                <Field label="Issue / Reason">
                  <textarea required value={verifyReason} onChange={e => setVerifyReason(e.target.value)} className={inputCls} rows={2} placeholder="Type the actual problem manually... e.g. Name mismatch" />
                </Field>
              )}
              {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
              <button disabled={loading} type="submit" className="flex items-center gap-1.5 bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">
                <ClipboardCheck size={13} /> {loading ? 'Saving...' : 'Submit Verification'}
              </button>
            </form>
          </div>
        )}

        {application.verificationStatus === 'VERIFIED' && (
          <div className="border-t border-border pt-4 text-xs text-teal flex items-center gap-1.5">
            <FileCheck size={13} /> Documents Verified
          </div>
        )}

        {/* Portal Submission Section */}
        {application.verificationStatus === 'VERIFIED' && application.portalSubmissionStatus !== 'COMPLETED' && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">EB/TANGEDCO Portal Submission</div>
            <form onSubmit={handlePortalSubmit} className="space-y-2.5">
              <Field label="Application / Reference Number">
                <input required value={portalRef} onChange={e => setPortalRef(e.target.value)} className={inputCls} placeholder="e.g. TANGEDCO-12345" />
              </Field>
              <Field label="Remarks">
                <textarea value={portalRemarks} onChange={e => setPortalRemarks(e.target.value)} className={inputCls} rows={2} />
              </Field>
              {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
              <button disabled={loading} type="submit" className="flex items-center gap-1.5 bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">
                <LayoutDashboard size={13} /> {loading ? 'Submitting...' : 'Record Portal Submission'}
              </button>
            </form>
          </div>
        )}

        {application.portalSubmissionStatus === 'COMPLETED' && (
          <div className="border-t border-border pt-4 text-xs text-teal flex flex-col gap-1">
            <div className="flex items-center gap-1.5"><Send size={13} /> Application Submitted in Portal</div>
            {application.portalReference && <div className="text-text-dim ml-5">Ref: {application.portalReference}</div>}
          </div>
        )}

        {/* Handover Section */}
        {application.portalSubmissionStatus === 'COMPLETED' && application.handoverStatus !== 'COMPLETED' && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Handover Application with EB Meter Supply</div>
            <form onSubmit={handleHandover} className="space-y-2.5">
              <Field label="Meter Supply Details">
                <textarea value={meterDetails} onChange={e => setMeterDetails(e.target.value)} className={inputCls} rows={2} placeholder="Enter meter serial, specs..." />
              </Field>
              <Field label="Remarks">
                <textarea value={handoverRemarks} onChange={e => setHandoverRemarks(e.target.value)} className={inputCls} rows={2} />
              </Field>
              {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
              <button disabled={loading} type="submit" className="flex items-center gap-1.5 bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">
                <Truck size={13} /> {loading ? 'Processing...' : 'Complete Handover'}
              </button>
            </form>
          </div>
        )}

        {application.handoverStatus === 'COMPLETED' && (
          <div className="border-t border-border pt-4 text-xs text-teal flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Handover Completed
          </div>
        )}

        {/* Stage History */}
        {history.length > 0 && (
          <div className="border-t border-border pt-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Stage History</div>
            <div className="space-y-1.5">
              {history.map(h => (
                <div key={h.id} className="text-xs bg-panel-raised border border-border rounded-lg p-2.5">
                  <div className="font-medium">{h.toStage}</div>
                  <div className="text-text-dim mt-0.5">{formatDate(h.changedAt)}</div>
                  {h.remarks && <div className="text-text-dim italic mt-0.5">{h.remarks}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
