import { useState } from 'react'
import { Modal, Field, inputCls, Pill } from '../shared/Primitives'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { formatINR, formatDate } from '../../lib/utils'
import type { Payment } from '../../types/models'

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Card'] as const
const PAYMENT_TYPES = ['Advance (50%)', 'Balance Payment', 'Full Payment'] as const

export function PaymentVerificationModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { verifyPayment, rejectPayment, markPaymentPartial, setPaymentFollowUp, projects, quotations } = useApp()
  const { employee } = useAuth()
  const [verifiedAmount, setVerifiedAmount] = useState(String(payment.actualAmount ?? payment.expectedAmount))
  const [expectedAmount, setExpectedAmount] = useState(payment.expectedAmount)
  const [paymentMode, setPaymentMode] = useState<string>(payment.paymentMode ?? 'UPI')
  const [paymentType, setPaymentType] = useState<string>(payment.paymentType || 'Advance (50%)')
  const [remarks, setRemarks] = useState(payment.remarks ?? '')
  const [followUpDate, setFollowUpDate] = useState((payment as any).followUpDate ?? '')
  const [rejectReason, setRejectReason] = useState('')
  const [mode, setMode] = useState<'review' | 'reject'>('review')

  const [selectedCustomerName, setSelectedCustomerName] = useState(payment.customerName)
  const [selectedProjectId, setSelectedProjectId] = useState(payment.projectId || '')
  const [selectedQuotationId, setSelectedQuotationId] = useState(payment.quotationId || '')
  const [selectedApprovedQuotationId, setSelectedApprovedQuotationId] = useState('')

  const approvedQuotations = quotations.filter((q) => q.status === 'Customer Approved' || q.status === 'Awaiting Advance' || q.status === 'Verified')
  const project = projects.find((p) => p.id === (selectedProjectId || payment.projectId))
  const quotation = quotations.find((q) => q.id === (selectedQuotationId || payment.quotationId))
  const amount = Number(verifiedAmount) || 0
  const difference = amount - expectedAmount
  const canAct = payment.state === 'Pending' || payment.state === 'Under Verification' || payment.state === 'Proof Uploaded'

  async function handleVerify() {
    if (!employee) return
    await verifyPayment(
      payment.id,
      amount,
      String(remarks).trim() || undefined,
      employee.name,
      paymentMode,
      {
        customerName: selectedCustomerName !== payment.customerName ? selectedCustomerName : undefined,
        projectId: selectedProjectId !== payment.projectId ? selectedProjectId : undefined,
        quotationId: selectedQuotationId !== payment.quotationId ? selectedQuotationId : undefined,
        paymentType: paymentType !== payment.paymentType ? paymentType : undefined,
      }
    )
    onClose()
  }

  async function handlePartial() {
    if (!employee) return
    await markPaymentPartial(payment.id, amount, String(remarks).trim() || undefined, employee.name, followUpDate || undefined)
    onClose()
  }

  async function handleReject() {
    if (!employee || !rejectReason.trim()) return
    await rejectPayment(payment.id, rejectReason.trim(), employee.name)
    onClose()
  }

  async function handleSaveFollowUp() {
    if (!followUpDate) return
    await setPaymentFollowUp(payment.id, followUpDate)
  }

  return (
    <Modal title="Payment Verification" onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium text-sm text-text">{payment.customerName}</div>
            <div className="text-xs text-text-dim mt-0.5">
              {project?.projectCode ?? payment.projectId} · {quotation?.quotationNumber ?? payment.quotationId}
            </div>
          </div>
          <Pill status={payment.state} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm bg-panel-raised border border-border rounded-lg p-3.5">
          <Info label="Customer" value={selectedCustomerName || payment.customerName} />
          <Info label="Project" value={project?.projectCode ?? '—'} />
          <Info label="Quotation" value={quotation?.quotationNumber ?? '—'} />
          <Info label="Payment Type" value={payment.paymentType} />
          {(selectedProjectId || payment.projectId) && (
            <Info label="Expected Amount" value={formatINR(expectedAmount)} />
          )}
          <Info label="Submitted Amount" value={formatINR(payment.actualAmount)} />
          <Info label="Payment Mode" value={payment.paymentMode ?? '—'} />
          <Info label="Transaction Reference" value={payment.transactionReference || '—'} mono />
          <Info label="Payment Date" value={formatDate(payment.paymentDate)} />
          <Info label="Submitted By" value={payment.submittedBy ?? '—'} />
        </div>

        {payment.proofs && payment.proofs.length > 0 && (
          <Field label="Payment Proof">
            <img src={payment.proofs[0].fileUrl} alt="Payment proof" className="w-full max-h-64 object-contain rounded-lg border border-border bg-black/[0.02]" />
          </Field>
        )}

        {!canAct ? (
          <div className="text-xs text-text-dim bg-panel-raised border border-border rounded-lg p-3">
            This payment is already <span className="font-medium">{payment.state}</span>
            {payment.verifiedBy && <> — actioned by {payment.verifiedBy}</>}.
            {payment.remarks && <div className="mt-1 italic">"{payment.remarks}"</div>}
            {(payment.state === 'Pending' || payment.state === 'Rejected') && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <Field label="Follow-up Date">
                  <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={inputCls} />
                </Field>
                <button onClick={handleSaveFollowUp} className="text-xs font-medium px-3 py-2 rounded-lg bg-sun/10 text-sun border border-sun/30 hover:bg-sun/20 transition-colors whitespace-nowrap">
                  Add Follow-up Date
                </button>
              </div>
            )}
          </div>
        ) : mode === 'reject' ? (
          <div className="space-y-3">
            <Field label="Rejection Reason">
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className={inputCls} placeholder="e.g. Transaction reference does not match bank statement" />
            </Field>
            <div className="flex gap-2">
              <button onClick={() => setMode('review')} className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-border text-text-dim hover:text-text transition-colors">Back</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-rose text-white hover:bg-rose/90 disabled:opacity-40 transition-colors">Confirm Reject</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {approvedQuotations.length > 0 && (
              <Field label="Link Customer Approved Data (Customer / Project / Quotation)">
                <select
                  className={inputCls}
                  value={selectedApprovedQuotationId}
                  onChange={(e) => {
                    const qId = e.target.value
                    setSelectedApprovedQuotationId(qId)
                    const q = quotations.find((item) => item.id === qId)
                    if (q) {
                      const linkedProject = projects.find((p) => p.quotationId === q.id)
                      setSelectedCustomerName(q.customerName)
                      setSelectedQuotationId(q.id)
                      setSelectedProjectId(linkedProject?.id || '')
                      setExpectedAmount(payment.paymentType === 'Balance Payment' ? (q.balanceAmount || q.grandTotal) : (q.advanceAmount || q.grandTotal))
                    }
                  }}
                >
                  <option value="">-- Select Customer Approved Data --</option>
                  {approvedQuotations.map((q) => {
                    const linkedProject = projects.find((p) => p.quotationId === q.id)
                    return (
                      <option key={q.id} value={q.id}>
                        {q.customerName} | Quotation #{q.quotationNumber} {linkedProject ? `(${linkedProject.projectCode})` : ''} | Adv: {formatINR(q.advanceAmount)} | Bal: {formatINR(q.balanceAmount)}
                      </option>
                    )
                  })}
                </select>
              </Field>

            )}
            <Field label="Payment Type">
              <select className={inputCls} value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Verified Amount (₹)">
                <input type="number" value={verifiedAmount} onChange={(e) => setVerifiedAmount(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Pending Amount">
                <div className={`${inputCls} flex items-center ${difference === 0 ? 'text-teal' : difference < 0 ? 'text-rose' : 'text-sun'}`}>
                  {difference === 0 ? 'No difference' : `${difference > 0 ? '+' : ''}${formatINR(difference)}`}
                </div>
              </Field>
            </div>
            <Field label="Payment Mode">
              <select className={inputCls} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Remarks">
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={inputCls} placeholder="Optional verification notes" />
            </Field>
            {difference !== 0 && (
              <Field label="Follow-up Date (for balance shortfall)">
                <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={inputCls} />
              </Field>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => setMode('reject')} className="text-xs font-medium px-3 py-2 rounded-lg border border-rose/30 text-rose hover:bg-rose/10 transition-colors">Reject</button>
              {difference !== 0 && (
                <button onClick={handlePartial} className="text-xs font-medium px-3 py-2 rounded-lg border border-sun/30 text-sun hover:bg-sun/10 transition-colors">Mark Partial</button>
              )}
              <button onClick={handleVerify} className="ml-auto text-xs font-semibold px-4 py-2 rounded-lg bg-teal text-white hover:bg-teal/90 transition-colors">
                Verify {difference === 0 ? 'Payment' : 'Full Amount'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text-dim font-medium">{label}</div>
      <div className={`text-text mt-0.5 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</div>
    </div>
  )
}
