import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useMarketing } from '../../store/MarketingStore'
import { Card, SectionHeading, Pill, Field, inputCls, Modal } from '../../components/shared/Primitives'
import { MapPin, Camera, Share2, Play, Square } from 'lucide-react'

// Mock nearby locations used to simulate live movement for a Direct Marketing
// field visit, in the absence of a real GPS backend.
const MOCK_WAYPOINTS = [
  'Head Office, Thillai Nagar',
  'Chathiram Bus Stand',
  'Cantonment Junction',
  'Near customer site, entering premises',
  'Customer site — visit in progress',
]

export default function FieldVisit() {
  const { employee } = useAuth()
  const { leads, fieldMovements, startFieldVisit, updateFieldVisit } = useMarketing()
  const [showStart, setShowStart] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [destination, setDestination] = useState('')
  const [waypointIdx, setWaypointIdx] = useState(0)
  const [noteDraft, setNoteDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const myVisits = useMemo(
    () => fieldMovements.filter((fm) => fm.employeeId === employee?.id),
    [fieldMovements, employee],
  )
  const activeVisit = myVisits.find((v) => v.status === 'On Field' || v.status === 'Checked In')
  const myLeads = useMemo(() => leads.filter((l) => l.assignedEmployeeId === employee?.id && l.status !== 'Not Interested' && l.status !== 'Converted'), [leads, employee])

  function submitStart(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    const lead = myLeads.find((l) => l.id === leadId)
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    startFieldVisit({
      employeeId: employee.id,
      employeeName: employee.name,
      role: 'Direct Marketing Executive',
      status: 'On Field',
      currentLocation: 'Head Office, Thillai Nagar',
      destination: destination || (lead ? `${lead.address}, ${lead.area}` : ''),
      startTime: now,
      leadId: lead?.id,
    })
    setWaypointIdx(0)
    setShowStart(false)
    setLeadId('')
    setDestination('')
  }

  function pushLocationUpdate() {
    if (!activeVisit) return
    const nextIdx = Math.min(waypointIdx + 1, MOCK_WAYPOINTS.length - 1)
    setWaypointIdx(nextIdx)
    updateFieldVisit(activeVisit.id, { location: MOCK_WAYPOINTS[nextIdx] })
  }

  function shareLocation() {
    if (!activeVisit) return
    updateFieldVisit(activeVisit.id, { note: `Location shared with CEO — ${activeVisit.currentLocation}` })
    alert('Live location shared with CEO / Field Movement dashboard.')
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeVisit) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateFieldVisit(activeVisit.id, { photo: reader.result })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function addNote() {
    if (!activeVisit || !noteDraft.trim()) return
    updateFieldVisit(activeVisit.id, { note: noteDraft.trim() })
    setNoteDraft('')
  }

  function endVisit() {
    if (!activeVisit) return
    updateFieldVisit(activeVisit.id, { status: 'Checked Out', location: 'Head Office, Thillai Nagar' })
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Direct / Field Marketing"
        title="Field Visit Tracking"
        action={!activeVisit && (
          <button onClick={() => setShowStart(true)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition flex items-center gap-2">
            <Play size={14} /> Start Visit
          </button>
        )}
      />
      <p className="text-xs text-text-dim -mt-3">
        Live location, photo capture, and location sharing for direct marketing field visits — the same field-visit capability used by the 1st Site Visit team.
      </p>

      {activeVisit ? (
        <Card className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-text-dim">Visit ID</div>
              <div className="font-mono text-sm text-teal">{activeVisit.id}</div>
            </div>
            <Pill status={activeVisit.status} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-text-dim">Current Location</div><div className="font-medium flex items-center gap-1.5"><MapPin size={14} className="text-sun" />{activeVisit.currentLocation}</div></div>
            <div><div className="text-xs text-text-dim">Destination</div><div className="font-medium">{activeVisit.destination || '—'}</div></div>
            <div><div className="text-xs text-text-dim">Started</div><div className="font-medium">{activeVisit.startTime}</div></div>
            <div><div className="text-xs text-text-dim">Last Update</div><div className="font-medium">{activeVisit.lastUpdate}</div></div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={pushLocationUpdate} disabled={waypointIdx >= MOCK_WAYPOINTS.length - 1} className="text-xs font-medium px-3 py-2 rounded-lg bg-sun/10 text-sun border border-sun/30 hover:bg-sun/20 transition-colors disabled:opacity-40 flex items-center gap-1.5">
              <MapPin size={13} /> Update Live Location
            </button>
            <button onClick={shareLocation} className="text-xs font-medium px-3 py-2 rounded-lg bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20 transition-colors flex items-center gap-1.5">
              <Share2 size={13} /> Share Location with CEO
            </button>
            <button onClick={() => fileRef.current?.click()} className="text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors flex items-center gap-1.5">
              <Camera size={13} /> Upload Site Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            <button onClick={endVisit} className="text-xs font-medium px-3 py-2 rounded-lg bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20 transition-colors flex items-center gap-1.5 ml-auto">
              <Square size={13} /> Check Out
            </button>
          </div>

          <div className="flex gap-2">
            <input className={inputCls} placeholder="Add a visit note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
            <button onClick={addNote} className="text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors whitespace-nowrap">Add Note</button>
          </div>

          {(activeVisit.photos?.length ?? 0) > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">Site Photos</div>
              <div className="flex gap-2 flex-wrap">
                {activeVisit.photos!.map((p, i) => (
                  <img key={i} src={p} alt={`Site photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-border" />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">Route / Activity Log</div>
            <div className="space-y-1.5 text-xs">
              {activeVisit.routeHistory.map((r, i) => (
                <div key={i} className="flex gap-3 text-text-dim"><span className="text-text font-medium w-16 shrink-0">{r.time}</span>{r.location}</div>
              ))}
              {activeVisit.visitNotes?.map((n, i) => (
                <div key={`n${i}`} className="flex gap-3 text-text-dim italic"><span className="w-16 shrink-0" />{n}</div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-text-dim">No active field visit. Start one above when you head out to meet a lead.</Card>
      )}

      <Card className="p-4">
        <SectionHeading eyebrow="History" title="My Field Visits" />
        <div className="space-y-2">
          {myVisits.filter((v) => v.id !== activeVisit?.id).map((v) => (
            <div key={v.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm border-t border-border pt-2 first:border-t-0 first:pt-0">
              <span className="font-mono text-xs text-teal w-16 shrink-0">{v.id}</span>
              <Pill status={v.status} />
              <span className="text-text-dim text-xs">{v.destination || v.currentLocation} · started {v.startTime}</span>
            </div>
          ))}
          {myVisits.length <= (activeVisit ? 1 : 0) && <div className="text-xs text-text-dim">No past visits yet.</div>}
        </div>
      </Card>

      {showStart && (
        <Modal title="Start Field Visit" onClose={() => setShowStart(false)}>
          <form onSubmit={submitStart} className="space-y-4">
            <Field label="Lead / Customer">
              <select className={inputCls} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">— Select a lead —</option>
                {myLeads.map((l) => <option key={l.id} value={l.id}>{l.customerName} — {l.area}</option>)}
              </select>
            </Field>
            <Field label="Destination"><input className={inputCls} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Auto-filled from lead, or type manually" /></Field>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button type="button" onClick={() => setShowStart(false)} className="text-xs font-medium text-text-dim px-4 py-2 rounded-xl hover:bg-slate-100 transition">Cancel</button>
              <button type="submit" className="bg-emerald-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition">Start Visit</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
