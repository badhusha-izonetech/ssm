import { useMemo, useState } from 'react'
import { useApp } from '../store/AppStore'
import { useAuth } from '../auth/AuthContext'
import { Card, SectionHeading, Pill, Field, inputCls, EmptyState } from '../components/shared/Primitives'
import { MapPin, Navigation, Clock, LogIn, LogOut, Camera, CheckCircle2, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react'
import { FieldCameraModal } from '../components/shared/FieldCameraModal'

const NEARBY_LOCATIONS = [
  'Thillai Nagar, Trichy',
  'Cantonment, Trichy',
  'Woraiyur, Trichy',
  'Srirangam, Trichy',
  'K.K. Nagar, Trichy',
  'Ariyamangalam, Trichy',
  'Thuvakudi, Trichy',
  'Anna Nagar, Trichy',
  'Chathiram Bus Stand, Trichy',
  'Trichy - Thanjavur Road',
]

const HOME_BASE = 'Head Office, Thillai Nagar'

function timeNow() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function FieldMobility() {
  const { fieldMovements, startFieldVisit, updateFieldVisit } = useApp()
  const { employee } = useAuth()

  const [task, setTask] = useState('')
  const [startLocation, setStartLocation] = useState(HOME_BASE)
  const [updateLocation, setUpdateLocation] = useState('')
  const [updateNote, setUpdateNote] = useState('')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)

  const mine = useMemo(
    () => fieldMovements.filter((f) => f.employeeId === employee?.id).slice().reverse(),
    [fieldMovements, employee],
  )

  const active = mine.find((f) => f.status !== 'Checked Out')
  const history = mine.filter((f) => f.status === 'Checked Out')

  if (!employee) return null

  function handleCheckIn() {
    setError('')
    if (!task.trim()) { setError('Describe the field task or destination before checking in.'); return }
    if (!employee) return
    startFieldVisit({
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.designation,
      status: 'Checked In',
      currentLocation: startLocation,
      destination: task.trim(),
      startTime: timeNow(),
    })
    setTask('')
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!active) return
    if (!updateLocation.trim()) { setError('Select or enter a current location to log the update.'); return }
    updateFieldVisit(active.id, {
      location: updateLocation.trim(),
      note: updateNote.trim() || undefined,
      photo: pendingPhoto ?? undefined,
      status: active.status === 'Checked In' ? 'On Field' : active.status,
    })
    setUpdateLocation('')
    setUpdateNote('')
    setPendingPhoto(null)
  }

  const handleCameraUpload = async (blob: Blob) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPendingPhoto(reader.result)
          resolve()
        }
      }
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(blob)
    })
  }

  function handleReturning() {
    if (!active) return
    updateFieldVisit(active.id, { status: 'Returning', location: active.currentLocation, note: 'Started return to office' })
  }

  function handleCheckOut() {
    if (!active) return
    updateFieldVisit(active.id, { status: 'Checked Out', location: HOME_BASE, note: 'Checked out' })
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Common Module"
        title="Field Mobility"
        action={<span className="text-xs text-text-dim">Simulated GPS — frontend demo only</span>}
      />

      {/* Current status */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Current Status</div>
          {active ? <Pill status={active.status} /> : <Pill status="Checked Out" />}
        </div>

        {!active ? (
          <div className="space-y-2.5">
            <div className="text-xs text-text-dim">Not currently checked in. Start a field session below.</div>
            <Field label="Field Task / Destination">
              <input value={task} onChange={(e) => setTask(e.target.value)} className={inputCls} placeholder="e.g. Site survey follow-up, Warehouse material pickup" />
            </Field>
            <Field label="Starting Location">
              <select value={startLocation} onChange={(e) => setStartLocation(e.target.value)} className={inputCls}>
                <option value={HOME_BASE}>{HOME_BASE}</option>
                {NEARBY_LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
            {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">{error}</div>}
            <button onClick={handleCheckIn} className="flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">
              <LogIn size={14} /> Check In
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-sm">
              <MapPin size={16} className="text-emerald-600 shrink-0" />
              <span className="font-semibold text-text">{active.currentLocation}</span>
              <span className="relative flex h-2.5 w-2.5 ml-auto">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
              </span>
            </div>
            {active.destination && (
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <Navigation size={13} className="shrink-0 text-emerald-600" /> Task: {active.destination}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <Clock size={13} className="shrink-0" /> Since {active.startTime} · Last update {active.lastUpdate}
            </div>

            <form onSubmit={handleUpdate} className="border-t border-border pt-4 space-y-3">
              <div className="text-xs uppercase tracking-wider text-text-dim font-semibold">Log Location Update</div>
              <Field label="Current Location">
                <div className="flex gap-2">
                  <select value={updateLocation} onChange={(e) => setUpdateLocation(e.target.value)} className={inputCls}>
                    <option value="">Select nearby area…</option>
                    {NEARBY_LOCATIONS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Note (optional)"><input value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} className={inputCls} placeholder="e.g. Reached site, discussing requirement" /></Field>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setShowCamera(true)} className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-white border border-border text-slate-700 hover:bg-slate-50 transition shadow-xs">
                  <Camera size={14} /> Geo-Tagged Photo {pendingPhoto && <CheckCircle2 size={14} className="text-emerald-600" />}
                </button>
              </div>
              {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">{error}</div>}
              <button type="submit" className="flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">
                <RefreshCcw size={14} /> Log Update
              </button>
            </form>

            <div className="border-t border-border pt-3 flex items-center gap-2 flex-wrap">
              {active.status !== 'Returning' && (
                <button onClick={handleReturning} className="flex items-center gap-2 bg-white border border-border text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-50 shadow-xs transition">
                  <Navigation size={14} /> Mark Returning to Office
                </button>
              )}
              <button onClick={handleCheckOut} className="flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 shadow-xs transition">
                <LogOut size={14} /> Check Out
              </button>
            </div>

            <div className="border-t border-border pt-3">
              <div className="text-[10px] uppercase tracking-wide text-text-dim font-semibold mb-2">Route History</div>
              <div className="space-y-2">
                {active.routeHistory.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    <span className="text-text-dim w-16 shrink-0">{r.time}</span>
                    <span className="truncate text-text font-medium">{r.location}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Visit history */}
      <Card className="p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Visit History</div>
        {history.length === 0 ? (
          <EmptyState title="No completed field visits yet" message="Checked-out sessions will appear here for reference." />
        ) : (
          <div className="space-y-2">
            {history.map((f) => {
              const isOpen = expanded === f.id
              return (
                <div key={f.id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : f.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-black/[0.03] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{f.destination ?? f.role}</div>
                      <div className="text-[11px] text-text-dim">{f.startTime} – {f.lastUpdate}</div>
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-text-dim shrink-0" /> : <ChevronDown size={14} className="text-text-dim shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-1.5 border-t border-border pt-2.5">
                      {f.routeHistory.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-sun shrink-0" />
                          <span className="text-text-dim w-16 shrink-0">{r.time}</span>
                          <span className="truncate">{r.location}</span>
                        </div>
                      ))}
                      {f.visitNotes && f.visitNotes.length > 0 && (
                        <div className="pt-1 space-y-1">
                          {f.visitNotes.map((n, i) => (
                            <div key={i} className="text-xs text-text-dim italic">"{n}"</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>



      {showCamera && active && (
        <FieldCameraModal
          onClose={() => setShowCamera(false)}
          onUpload={handleCameraUpload}
          taskName={active.destination || 'Field Mobility Task'}
          currentLocation={updateLocation || active.currentLocation}
        />
      )}
    </div>
  )
}
