import { useMemo, useRef, useState } from 'react'
import { useApp } from '../store/AppStore'
import { useAuth } from '../auth/AuthContext'
import { Card, SectionHeading, Pill, Field, inputCls, EmptyState } from '../components/shared/Primitives'
import { formatDate } from '../lib/utils'
import { Check, X, LogIn, LogOut, Paperclip, CheckCircle2, Clock } from 'lucide-react'

function readFile(file: File, cb: (dataUrl: string) => void) {
  const reader = new FileReader()
  reader.onload = () => { if (typeof reader.result === 'string') cb(reader.result) }
  reader.readAsDataURL(file)
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function Leave() {
  const { leaveRequests, applyLeave, decideLeave, attendanceRecords, checkInAttendance, checkOutAttendance } = useApp()
  const { employee, portal } = useAuth()
  const isCeo = portal === 'CEO'

  const [tab, setTab] = useState<'attendance' | 'leave'>('attendance')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // ----- Attendance (self) -----
  const today = todayIso()
  const myToday = attendanceRecords.find((a) => a.employeeId === employee?.id && a.date === today)
  const myHistory = useMemo(
    () => attendanceRecords.filter((a) => a.employeeId === employee?.id).slice().reverse().slice(0, 10),
    [attendanceRecords, employee],
  )

  async function handleCheckIn(type: 'Office' | 'Field') {
    if (!employee) return
    await checkInAttendance({ employeeId: employee.id, employeeName: employee.name, department: employee.department, type })
  }
  async function handleCheckOut() {
    if (!employee) return
    await checkOutAttendance(employee.id)
  }

  // ----- Leave (self) -----
  const [leaveType, setLeaveType] = useState<'Casual' | 'Sick' | 'Emergency' | 'Unpaid'>('Casual')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [certificate, setCertificate] = useState<string | null>(null)
  const [leaveError, setLeaveError] = useState('')
  const [leaveSuccess, setLeaveSuccess] = useState('')
  const certRef = useRef<HTMLInputElement>(null)

  const myLeaveRequests = useMemo(
    () => leaveRequests.filter((r) => r.employeeId === employee?.id),
    [leaveRequests, employee],
  )

  async function handleApplyLeave(e: React.FormEvent) {
    e.preventDefault()
    setLeaveError('')
    setLeaveSuccess('')
    if (!employee) return
    if (!fromDate || !toDate || !reason.trim()) { setLeaveError('From date, to date, and reason are required.'); return }
    if (toDate < fromDate) { setLeaveError('To date cannot be before from date.'); return }
    const result = await applyLeave({
      employeeId: employee.id,
      employeeName: employee.name,
      leaveType,
      fromDate,
      toDate,
      reason: reason.trim(),
      medicalCertificate: certificate ?? undefined,
    })
    if (!result.ok) { setLeaveError(result.error ?? 'Could not submit leave request.'); return }
    setLeaveSuccess('Leave request submitted for CEO approval.')
    setFromDate(''); setToDate(''); setReason(''); setCertificate(null)
  }

  // ----- Team oversight (CEO only) -----
  const teamToday = useMemo(() => attendanceRecords.filter((a) => a.date === today), [attendanceRecords, today])
  const pendingLeave = leaveRequests.filter((r) => r.status === 'Pending')
  const decidedLeave = leaveRequests.filter((r) => r.status !== 'Pending')
  const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({})

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Common Module"
        title="Attendance & Leave"
        action={isCeo ? <span className="text-xs text-text-dim">{pendingLeave.length} leave requests pending</span> : undefined}
      />

      <div className="flex rounded-xl p-1 bg-panel-raised border border-border w-fit shadow-xs">
        <button
          onClick={() => setTab('attendance')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'attendance' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'
          }`}
        >
          Attendance
        </button>
        <button
          onClick={() => setTab('leave')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'leave' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'
          }`}
        >
          Leave
        </button>
      </div>

      {tab === 'attendance' && (
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-text-dim font-semibold">Today's Attendance</div>
              {myToday && <Pill status={myToday.status} />}
            </div>

            {!myToday || myToday.status === 'On Leave' ? (
              myToday?.status === 'On Leave' ? (
                <div className="text-xs text-text-dim">You're marked on leave today.</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-text-dim">Not checked in yet.</div>
                  <div className="flex gap-2.5 flex-wrap">
                    <button onClick={() => handleCheckIn('Office')} className="flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">
                      <LogIn size={14} /> Check In — Office
                    </button>
                    <button onClick={() => handleCheckIn('Field')} className="flex items-center gap-2 bg-white border border-border text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-50 shadow-xs transition">
                      <LogIn size={14} /> Check In — Field
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-text-dim">
                  <Clock size={14} className="shrink-0 text-emerald-600" /> <span className="font-medium text-text">{myToday.type}</span> · Checked in {myToday.checkInTime}
                  {myToday.checkOutTime && <> · Checked out {myToday.checkOutTime}</>}
                </div>
                {!myToday.checkOutTime && (
                  <button onClick={handleCheckOut} className="flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 shadow-xs transition">
                    <LogOut size={14} /> Check Out
                  </button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">My Recent Attendance</div>
            {myHistory.length === 0 ? (
              <EmptyState title="No attendance history" message="Your check-ins will appear here." />
            ) : (
              <div className="space-y-1.5">
                {myHistory.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-text-dim w-24 shrink-0">{formatDate(a.date)}</span>
                      <span>{a.type}</span>
                      {a.checkInTime && <span className="text-text-dim">{a.checkInTime}{a.checkOutTime ? ` – ${a.checkOutTime}` : ''}</span>}
                    </div>
                    <Pill status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {isCeo && (
            <Card className="p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Team Attendance — Today</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {teamToday.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-panel-raised border border-border">
                    <div>
                      <div className="font-medium">{a.employeeName}</div>
                      <div className="text-text-dim">{a.department} · {a.type}</div>
                    </div>
                    <Pill status={a.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'leave' && (
        <div className="space-y-5">
          {!isCeo && (
            <>
              <Card className="p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Apply for Leave</div>
                <form onSubmit={handleApplyLeave} className="space-y-2.5">
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <Field label="Leave Type">
                      <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as typeof leaveType)} className={inputCls}>
                        <option value="Casual">Casual</option>
                        <option value="Sick">Sick</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Unpaid">Unpaid</option>
                      </select>
                    </Field>
                    <div />
                    <Field label="From Date"><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} /></Field>
                    <Field label="To Date"><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} /></Field>
                  </div>
                  <Field label="Reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputCls} placeholder="Briefly describe the reason for leave" /></Field>

                  {leaveType === 'Casual' && (
                    <div className="text-[11px] text-sun">Casual leave requires at least 3 days advance notice.</div>
                  )}
                  {leaveType === 'Sick' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => certRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                        <Paperclip size={13} /> Attach Medical Certificate {certificate && <CheckCircle2 size={13} className="text-teal" />}
                      </button>
                      <input ref={certRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, setCertificate); e.target.value = '' }} />
                      <span className="text-[11px] text-text-dim">Required for sick leave</span>
                    </div>
                  )}

                  {leaveError && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{leaveError}</div>}
                  {leaveSuccess && <div className="text-xs text-teal bg-teal/10 border border-teal/30 rounded-lg px-3 py-2">{leaveSuccess}</div>}

                  <button type="submit" className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">
                    Submit Request
                  </button>
                </form>
              </Card>

              <Card className="p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">My Leave Requests</div>
                {myLeaveRequests.length === 0 ? (
                  <EmptyState title="No leave requests yet" message="Requests you submit will appear here." />
                ) : (
                  <div className="space-y-2">
                    {myLeaveRequests.map((r) => (
                      <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between text-xs py-2 border-b border-border last:border-0">
                        <div>
                          <div className="font-medium">{r.leaveType} leave · {formatDate(r.fromDate)} – {formatDate(r.toDate)}</div>
                          <div className="text-text-dim">{r.reason}</div>
                          {r.ceoRemarks && <div className="text-text-dim italic mt-0.5">{r.ceoRemarks}</div>}
                        </div>
                        <Pill status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}

          {isCeo && (
            <>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">Pending Requests — All Employees</div>
                <div className="space-y-2">
                  {pendingLeave.map((r) => (
                    <Card key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:border-emerald-200 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-text">{r.employeeName}</div>
                        <div className="text-xs text-text-dim">{r.leaveType} leave · {formatDate(r.fromDate)} – {formatDate(r.toDate)}</div>
                        <div className="text-xs text-text-dim mt-0.5">{r.reason}</div>
                        {r.leaveType === 'Casual' && (
                          <div className="text-xs text-amber-700 font-medium mt-1">Casual leave — applied {formatDate(r.appliedOn)}.</div>
                        )}
                        {r.medicalCertificate && (
                          <div className="mt-2">
                            <div className="text-xs text-emerald-700 font-medium flex items-center gap-1 mb-1"><Paperclip size={12} /> Medical certificate attached</div>
                            {r.medicalCertificate.startsWith('data:image') ? (
                              <button onClick={() => setSelectedImage(r.medicalCertificate ?? null)} className="block text-left">
                                <img src={r.medicalCertificate} alt="Medical Certificate" className="w-24 h-24 object-cover border border-border rounded-lg shadow-sm hover:opacity-80 transition-opacity cursor-zoom-in" />
                              </button>
                            ) : (
                              <a href={r.medicalCertificate} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-medium hover:underline">View Certificate</a>
                            )}
                          </div>
                        )}
                        <input
                          value={remarksDraft[r.id] ?? ''}
                          onChange={(e) => setRemarksDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Remarks (optional)"
                          className={`${inputCls} mt-2 text-xs`}
                        />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => decideLeave(r.id, 'Approved', remarksDraft[r.id])} className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 transition">
                          <Check size={14} /> Approve
                        </button>
                        <button onClick={() => decideLeave(r.id, 'Rejected', remarksDraft[r.id])} className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition">
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </Card>
                  ))}
                  {pendingLeave.length === 0 && <div className="text-sm text-text-dim">No pending leave requests.</div>}
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">Decided</div>
                <div className="space-y-2">
                  {decidedLeave.map((r) => (
                    <Card key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{r.employeeName}</div>
                        <div className="text-xs text-text-dim">{r.leaveType} leave · {formatDate(r.fromDate)} – {formatDate(r.toDate)}</div>
                        {r.ceoRemarks && <div className="text-xs text-text-dim mt-0.5">{r.ceoRemarks}</div>}
                      </div>
                      <Pill status={r.status} />
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Expanded Certificate" className="max-w-full max-h-[90vh] object-contain rounded" />
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2" onClick={() => setSelectedImage(null)}>
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
