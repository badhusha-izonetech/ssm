import { useRef, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { Pill, Field, inputCls, Modal } from '../shared/Primitives'
import { formatDate } from '../../lib/utils'
import type { Delivery } from '../../types/models'
import { MapPin, Camera, Play, Navigation, CheckCircle2, Undo2, Flag, PackageCheck } from 'lucide-react'

const MOCK_WAYPOINTS = [
  'Warehouse, Ariyamangalam',
  'Trichy - Thanjavur Road',
  'Chathiram Bus Stand',
  'Approaching destination',
]

export function DeliveryDetail({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  const { fieldMovements, startTrip, updateTripLocation, recordArrival, capturePickupPhoto, captureDeliveryPhoto, confirmDelivery, startReturnTrip, recordReturnedMaterial, endTrip } = useApp()
  const [waypointIdx, setWaypointIdx] = useState(0)
  const [receivedBy, setReceivedBy] = useState('')
  const [confirmNotes, setConfirmNotes] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [formError, setFormError] = useState('')

  const pickupPhotoRef = useRef<HTMLInputElement>(null)
  const deliveryPhotoRef = useRef<HTMLInputElement>(null)
  const returnPhotoRef = useRef<HTMLInputElement>(null)

  const movement = delivery.fieldMovementId ? fieldMovements.find((f) => f.id === delivery.fieldMovementId) : undefined

  function readFile(file: File, cb: (dataUrl: string) => void) {
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') cb(reader.result) }
    reader.readAsDataURL(file)
  }

  function handlePickupPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    readFile(file, (dataUrl) => capturePickupPhoto(delivery.id, dataUrl))
    e.target.value = ''
  }

  function handleDeliveryPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    readFile(file, (dataUrl) => captureDeliveryPhoto(delivery.id, dataUrl))
    e.target.value = ''
  }

  function handleReturnPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    readFile(file, (dataUrl) => recordReturnedMaterial(delivery.id, dataUrl, returnNotes.trim() || undefined))
    e.target.value = ''
  }

  function pushLocationUpdate() {
    const nextIdx = Math.min(waypointIdx + 1, MOCK_WAYPOINTS.length - 1)
    setWaypointIdx(nextIdx)
    updateTripLocation(delivery.id, MOCK_WAYPOINTS[nextIdx])
  }

  function submitConfirmation(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!receivedBy.trim()) { setFormError('Enter who received the material at site.'); return }
    if (!delivery.deliveryPhoto) { setFormError('Capture a delivery photo before confirming.'); return }
    confirmDelivery(delivery.id, receivedBy.trim(), confirmNotes.trim() || undefined)
  }

  return (
    <Modal title={`Delivery — ${delivery.customerName}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div className="text-xs text-text-dim">Delivery ID <span className="font-mono text-teal">{delivery.id}</span></div>
          <Pill status={delivery.status} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-text-dim">Project</div><div className="font-medium">{delivery.projectCode}</div></div>
          <div><div className="text-xs text-text-dim">Customer</div><div className="font-medium">{delivery.customerName}</div></div>
          <div><div className="text-xs text-text-dim">Pickup</div><div className="font-medium">{delivery.pickup}</div></div>
          <div><div className="text-xs text-text-dim">Destination</div><div className="font-medium">{delivery.destination}</div></div>
          <div className="sm:col-span-2"><div className="text-xs text-text-dim">Material Summary</div><div className="font-medium">{delivery.materialSummary}</div></div>
          <div><div className="text-xs text-text-dim">Scheduled Date</div><div className="font-medium">{formatDate(delivery.scheduledDate)}</div></div>
        </div>

        {/* Tasks: pickup evidence */}
        <div className="border-t border-border pt-4">
          <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">Pickup Evidence</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => pickupPhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
              <Camera size={13} /> Pickup Photo {delivery.pickupPhoto && <CheckCircle2 size={13} className="text-teal" />}
            </button>
            <input ref={pickupPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePickupPhoto} />
            {delivery.pickupPhoto && <span className="text-xs text-teal">Captured</span>}
          </div>
        </div>

        {/* Movement */}
        {(delivery.status === 'Assigned' || delivery.status === 'Trip Started' || delivery.status === 'On Route' || delivery.status === 'Returning') && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Movement</div>
            {delivery.status === 'Assigned' ? (
              <button onClick={() => startTrip(delivery.id)} className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors flex items-center gap-1.5">
                <Play size={13} /> Start Trip
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-sun shrink-0" />
                  <span>{movement?.currentLocation ?? delivery.pickup}</span>
                  <span className="relative flex h-2 w-2 ml-auto">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-dim">
                  <Navigation size={13} className="shrink-0" /> Heading to {delivery.status === 'Returning' ? delivery.pickup : delivery.destination}
                </div>
                <button type="button" onClick={pushLocationUpdate} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                  <Navigation size={13} /> Simulate GPS Update
                </button>
                {movement && movement.routeHistory.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-text-dim font-medium mb-1.5">Route History</div>
                    <div className="space-y-1.5">
                      {movement.routeHistory.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-sun shrink-0" />
                          <span className="text-text-dim w-16 shrink-0">{r.time}</span>
                          <span className="truncate">{r.location}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {delivery.status !== 'Returning' && (
                  <button onClick={() => recordArrival(delivery.id)} className="flex items-center gap-1.5 bg-teal text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">
                    <Flag size={13} /> Mark Arrival
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Delivery confirmation */}
        {(delivery.status === 'Arrived' || delivery.status === 'Delivered' || delivery.status === 'Returning' || delivery.status === 'Completed') && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Delivery Confirmation</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => deliveryPhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                <Camera size={13} /> Delivery Photo {delivery.deliveryPhoto && <CheckCircle2 size={13} className="text-teal" />}
              </button>
              <input ref={deliveryPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDeliveryPhoto} />
            </div>

            {delivery.deliveryConfirmation ? (
              <div className="text-xs text-text-dim bg-panel-raised border border-border rounded-lg p-3">
                <div className="text-teal font-medium mb-0.5 flex items-center gap-1.5"><PackageCheck size={13} /> Confirmed</div>
                Received by {delivery.deliveryConfirmation.receivedBy} on {formatDate(delivery.deliveryConfirmation.confirmedOn)}
                {delivery.deliveryConfirmation.notes && <div className="italic mt-0.5">{delivery.deliveryConfirmation.notes}</div>}
              </div>
            ) : delivery.status === 'Arrived' ? (
              <form onSubmit={submitConfirmation} className="space-y-3">
                <Field label="Received By"><input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className={inputCls} placeholder="e.g. Site Supervisor name" /></Field>
                <Field label="Confirmation Notes"><textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} rows={2} className={inputCls} /></Field>
                {formError && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{formError}</div>}
                <button type="submit" className="bg-teal text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">Confirm Delivery</button>
              </form>
            ) : null}
          </div>
        )}

        {/* Return trip */}
        {delivery.status === 'Delivered' && (
          <div className="border-t border-border pt-4">
            <button onClick={() => startReturnTrip(delivery.id)} className="flex items-center gap-1.5 bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors">
              <Undo2 size={13} /> Start Return Trip
            </button>
          </div>
        )}

        {delivery.status === 'Returning' && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Returned Material Evidence (unused / excess)</div>
            <Field label="Return Notes"><textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} rows={2} className={inputCls} placeholder="Optional — describe unused / excess material being returned" /></Field>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => returnPhotoRef.current?.click()} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors">
                <Camera size={13} /> Add Return Evidence
              </button>
              <input ref={returnPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReturnPhoto} />
              {(delivery.returnedMaterialEvidence?.length ?? 0) > 0 && <span className="text-xs text-teal">{delivery.returnedMaterialEvidence!.length} captured</span>}
            </div>
            <button onClick={() => endTrip(delivery.id)} className="flex items-center gap-1.5 bg-teal text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:brightness-95 transition-all">
              <CheckCircle2 size={13} /> End Trip
            </button>
          </div>
        )}

        {delivery.status === 'Completed' && (
          <div className="border-t border-border pt-4 text-xs text-teal flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Trip completed on {formatDate(delivery.completedOn ?? '')}
          </div>
        )}
      </div>
    </Modal>
  )
}
