import { useRef, useState, useEffect } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'

import { Field, inputCls, Modal } from '../shared/Primitives'
import { formatINR } from '../../lib/utils'
import type { Payment, PaymentType } from '../../types/models'
import { Camera } from 'lucide-react'

const PAYMENT_TYPES: PaymentType[] = ['Advance (50%)', 'Balance Payment', 'Partial Payment', 'Full Payment']
const PAYMENT_MODES: Array<'UPI' | 'Bank Transfer' | 'Cheque' | 'Cash' | 'Card'> = ['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Card']

export function PaymentSubmissionModal({ onClose, initialProjectId, editPayment }: { onClose: () => void; initialProjectId?: string; editPayment?: Payment }) {
  const { projects, submitPayment, updatePayment, quotations } = useApp()
  const { employee, portal } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [projectId, setProjectId] = useState(editPayment?.projectId || initialProjectId || '')
  const [expectedAmount, setExpectedAmount] = useState(editPayment?.expectedAmount?.toString() || '')
  const [actualAmount, setActualAmount] = useState(editPayment?.actualAmount?.toString() || '')
  const [paymentType, setPaymentType] = useState<PaymentType>((editPayment?.paymentType as PaymentType) || 'Advance (50%)')
  const [paymentDate, setPaymentDate] = useState(() => editPayment?.paymentDate || new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]>((editPayment?.paymentMode as any) || 'UPI')
  const [transactionReference, setTransactionReference] = useState(editPayment?.transactionReference || '')
  const [screenshot, setScreenshot] = useState(editPayment?.proofs?.[0]?.fileUrl || '')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [otherCustomerName, setOtherCustomerName] = useState(editPayment && !editPayment.projectId ? editPayment.customerName : '')
  const [remarks, setRemarks] = useState(editPayment?.remarks || '')
  const [error, setError] = useState('')

  const project = projects.find((p) => p.id === projectId)

  useEffect(() => {
    if (editPayment) return; // Don't auto-calculate expected amount if editing
    if (!project) {
      setExpectedAmount('')
      return
    }
    if (paymentType === 'Advance (50%)') {
      const q = quotations.find((q) => q.id === project.quotationId)
      if (q && q.advanceAmount) {
        setExpectedAmount(q.advanceAmount.toString())
      } else {
        setExpectedAmount(Math.round(project.projectValue / 2).toString())
      }
    } else if (paymentType === 'Balance Payment' || paymentType === 'Full Payment') {
      setExpectedAmount(project.balanceAmount.toString())
    } else {
      setExpectedAmount('')
    }
  }, [projectId, paymentType, project, quotations])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshotFile(file)
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setScreenshot(reader.result) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!projectId) { setError('Select a project.'); return }
    if (projectId === 'Other' && !otherCustomerName.trim()) { setError('Enter customer name for Other payment.'); return }
    if (!actualAmount) { setError('Enter actual amount.'); return }
    if (projectId !== 'Other' && !expectedAmount) { setError('Enter expected amount.'); return }
    if (!employee) return

    const cName = projectId === 'Other' ? otherCustomerName : (project?.customerName || '')
    const qId = (projectId === 'Other' || !project?.quotationId) ? undefined : project.quotationId
    const pId = (projectId === 'Other' || !project?.id) ? undefined : project.id

    if (editPayment) {
      await updatePayment(editPayment.id, {
        projectId: pId,
        customerName: cName,
        quotationId: qId,
        expectedAmount: Number(projectId === 'Other' ? actualAmount : expectedAmount),
        actualAmount: Number(actualAmount),
        paymentType,
        paymentDate,
        paymentMode,
        transactionReference,
        paymentScreenshotFile: screenshotFile,
        remarks: remarks || undefined,
      })
    } else {
      await submitPayment({
        projectId: pId,
        customerName: cName,
        quotationId: qId,
        expectedAmount: Number(projectId === 'Other' ? actualAmount : expectedAmount),
        actualAmount: Number(actualAmount),
        paymentType,
        paymentDate,
        paymentMode,
        transactionReference,
        paymentScreenshotFile: screenshotFile,
        submittedBy: employee.name,
        remarks: remarks || undefined,
      })
    }
    onClose()
  }

  return (
    <Modal title={editPayment ? "Edit Payment" : "Submit Payment"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Project">
          <select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— Select a project —</option>
            {projects.filter((p) => {
              const bal = Number(p.balanceAmount) || 0;
              const adv = Number(p.advanceReceived) || 0;
              return bal > 0 || adv === 0 || p.currentStage === 'Awaiting Advance Payment';
            }).map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode} — {p.customerName} ({p.site})</option>
            ))}
            <option value="Other">Other (General Payment)</option>
          </select>
        </Field>
        {projectId === 'Other' && (
          <Field label="Customer Name / Details">
            <input required className={inputCls} value={otherCustomerName} onChange={(e) => setOtherCustomerName(e.target.value)} placeholder="e.g. John Doe - Maintenance" />
          </Field>
        )}
        {project && projectId !== 'Other' && (
          <div className="text-xs text-text-dim bg-panel-raised border border-border rounded-lg px-3 py-2">
            Project Value {formatINR(project.projectValue)} · Advance Received {formatINR(project.advanceReceived)} · Balance {formatINR(project.balanceAmount)}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Payment Type">
            <select className={inputCls} value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}>
              {PAYMENT_TYPES.filter(t => !(portal === 'Partner' && t === 'Partial Payment')).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Payment Mode">
            <select className={inputCls} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          {projectId && projectId !== 'Other' && (
            <Field label="Expected Amount (₹)"><input type="number" min={0} className={inputCls} value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value)} /></Field>
          )}
          <Field label="Actual Amount Received (₹)"><input type="number" min={0} className={inputCls} value={actualAmount} onChange={(e) => setActualAmount(e.target.value)} /></Field>
          <Field label="Payment Date"><input type="date" className={inputCls} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></Field>
          <Field label="Transaction Reference"><input className={inputCls} value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="e.g. UPI-902361902" /></Field>
        </div>
        <Field label="Payment Screenshot / Proof">
          <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors flex items-center gap-1.5">
            <Camera size={13} /> {screenshot ? 'Screenshot Attached ✓' : 'Attach Screenshot'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </Field>
        {screenshot && <img src={screenshot} alt="Payment proof" className="w-24 h-24 object-cover rounded-lg border border-border" />}
        <Field label="Remarks"><textarea className={inputCls} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" /></Field>
        {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-xs text-text-dim px-3 py-2">Cancel</button>
          <button type="submit" className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors">
            {editPayment ? "Save Changes" : "Submit Payment"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
