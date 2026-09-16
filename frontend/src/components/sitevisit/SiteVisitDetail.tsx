import { useRef, useState, useEffect } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, Pill, Field, inputCls, Modal } from '../shared/Primitives'
import { formatDate } from '../../lib/utils'
import type { SiteVisit, FeasibilityResult, LostReason } from '../../types/models'
import { useAuth } from '../../auth/AuthContext'
import { Camera, Video, FileImage, FileText, Play, CheckCircle2, Download, Plus, Trash2 } from 'lucide-react'
import { useSiteVisitTracking } from '../../hooks/useSiteVisitTracking'
import { SiteVisitCameraModal } from './SiteVisitCameraModal'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const workerIcon = L.divIcon({
  html: '<div style="font-size: 28px; line-height: 28px; text-align: center; margin-left: -14px; margin-top: -14px;">🚗</div>',
  className: 'bg-transparent border-none',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function LiveWorkerMarker({ location, employeeName }: { location: { latitude: number; longitude: number } | null, employeeName: string }) {
  const map = useMap()
  const hasCentered = useRef(false)
  const isFollowing = useRef(true)

  const currentPosRef = useRef(location)
  const [displayLocation, setDisplayLocation] = useState(location)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!location) return
    if (!currentPosRef.current) {
      currentPosRef.current = location
      setDisplayLocation(location)
      return
    }

    const startLat = currentPosRef.current.latitude
    const startLng = currentPosRef.current.longitude
    const endLat = location.latitude
    const endLng = location.longitude

    if (startLat === endLat && startLng === endLng) return

    const startTime = performance.now()
    const duration = 1000

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3)

      const currentLat = startLat + (endLat - startLat) * easeProgress
      const currentLng = startLng + (endLng - startLng) * easeProgress
      
      const newPos = { latitude: currentLat, longitude: currentLng }
      currentPosRef.current = newPos
      setDisplayLocation(newPos)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [location])

  useEffect(() => {
    const handleDrag = () => { isFollowing.current = false }
    map.on('dragstart', handleDrag)
    return () => { map.off('dragstart', handleDrag) }
  }, [map])

  useEffect(() => {
    if (!location) return
    const newPos = L.latLng(location.latitude, location.longitude)
    
    if (!hasCentered.current) {
       map.setView(newPos, 15)
       hasCentered.current = true
    } else if (isFollowing.current) {
       map.flyTo(newPos, map.getZoom(), { animate: true, duration: 1.0 })
    }
  }, [location, map])

  if (!displayLocation) return null
  return (
    <Marker position={[displayLocation.latitude, displayLocation.longitude]} icon={workerIcon}>
      <Popup>Field Worker ({employeeName})</Popup>
    </Marker>
  )
}


const FEASIBILITY_OPTIONS: FeasibilityResult[] = [
  'Feasible',
  'Feasible with Conditions',
  'Revisit Required',
  'Not Feasible',
  'Customer Requirement Not Supported',
]

const REJECTION_REASONS: LostReason[] = [
  'Technical Infeasibility',
  'Company Cannot Provide Requirement',
  'Price',
  'Customer Postponed',
  'Other',
]

function EvidenceRow({ label, icon: Icon, count, onPick, accept, capture }: { label: string; icon: typeof Camera; count: number; onPick: () => void; accept: string; capture?: boolean }) {
  return (
    <button
      onClick={onPick}
      className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors"
      type="button"
    >
      <Icon size={13} /> {label}{count > 0 && <span className="text-teal">({count})</span>}
      <span className="hidden">{accept}{capture}</span>
    </button>
  )
}

function EvidenceItem({ src, label, isVideo, isDoc }: { src: string, label?: string, isVideo?: boolean, isDoc?: boolean }) {
  const url = src?.startsWith('/uploads') ? `http://localhost:8000${src}` : src
  return (
    <a href={url} target="_blank" rel="noreferrer" download className="group relative block w-16 h-16 rounded-lg overflow-hidden border border-border bg-black/[0.02]" title={label}>
      {isVideo ? (
        <video src={url} className="w-full h-full object-cover" />
      ) : isDoc ? (
        <div className="w-full h-full flex items-center justify-center text-xs font-medium text-text-dim">DOC</div>
      ) : (
        <img src={url} alt="Evidence" className="w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        <Download size={16} />
      </div>
    </a>
  )
}

function EvidenceGallery({ visit }: { visit: SiteVisit }) {
  const toolBefore = visit.toolPhotoBefore
  const toolAfter = visit.toolPhotoAfter

  const filteredPhotos = visit.photos?.filter((p: any) => !p.stage) || []
  const totalEvidence = filteredPhotos.length + (visit.videos?.length || 0) + (visit.measurementImages?.length || 0) + (visit.documents?.length || 0) + (visit.sitePhotos?.length || 0)

  if (totalEvidence === 0 && !toolBefore && !toolAfter) return null

  return (
    <Card className="p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">
        Evidence & Equipment Photos ({totalEvidence + (toolBefore ? 1 : 0) + (toolAfter ? 1 : 0)})
      </div>

      {(toolBefore || toolAfter) && (
        <div className="space-y-1.5 pb-3 border-b border-border">
          <div className="text-xs font-semibold text-text-dim">
            {visit.siteType === 'Final Review' ? 'Final Review Site Photos' : 'Tools / Equipment Photos'}
          </div>
          <div className="flex gap-3">
            {toolBefore && (
              <div className="space-y-1">
                <div className="text-[10px] text-text-dim">{visit.siteType === 'Final Review' ? 'Site Photo 1' : 'Before Work'}</div>
                <EvidenceItem src={toolBefore} label={visit.siteType === 'Final Review' ? 'Site Photo 1' : 'Tool Photo Before'} />
              </div>
            )}
            {toolAfter && (
              <div className="space-y-1">
                <div className="text-[10px] text-text-dim">{visit.siteType === 'Final Review' ? 'Site Photo 2' : 'After Work'}</div>
                <EvidenceItem src={toolAfter} label={visit.siteType === 'Final Review' ? 'Site Photo 2' : 'Tool Photo After'} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {filteredPhotos.map((p: any) => (
          <EvidenceItem key={p.id} src={p.filePath} label={`GPS: ${p.latitude}, ${p.longitude} (Acc: ${p.accuracy}m)`} />
        ))}
        {visit.videos && visit.videos.map((p, i) => <EvidenceItem key={`v${i}`} src={p} isVideo />)}
        {visit.measurementImages && visit.measurementImages.map((p, i) => <EvidenceItem key={`m${i}`} src={p} />)}
        {visit.documents && visit.documents.map((p, i) => <EvidenceItem key={`d${i}`} src={p} isDoc />)}
        {visit.sitePhotos && visit.sitePhotos.map((p, i) => <EvidenceItem key={`sp${i}`} src={p} />)}
      </div>
    </Card>
  )
}

function ProjectStagesGallery({ visit, project }: { visit: SiteVisit; project?: any }) {
  const uploads = project?.uploads || []
  const completedStages = visit.completedStages || []

  const stagesFromUploads = uploads.filter((u: any) => u.stage).map((u: any) => u.stage!)
  const allStages = Array.from(new Set([...completedStages, ...stagesFromUploads]))

  if (allStages.length === 0 && uploads.length === 0) return null

  return (
    <Card className="p-4 space-y-3 mt-4">
      <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-2">Installation Stage Photos</div>
      <div className="space-y-4">
        {allStages.map(stage => {
          const visitPhotos = visit.photos?.filter((p: any) => p.stage === stage) || []
          // If we have GPS-tagged visit photos, ignore the project uploads to prevent duplicates from the old tech app bug
          const projectPhotos = visitPhotos.length > 0 ? [] : uploads.filter((u: any) => u.stage === stage)

          return (
            <div key={stage} className="space-y-2 border-b border-border last:border-0 pb-3 last:pb-0">
              <div className="text-sm font-medium flex items-center gap-2 text-teal">
                <CheckCircle2 size={16} /> {stage}
              </div>
              <div className="flex gap-2 flex-wrap pl-6">
                {visitPhotos.map((p: any) => (
                  <EvidenceItem key={p.id} src={p.filePath} label={`GPS: ${p.latitude}, ${p.longitude}`} />
                ))}
                {projectPhotos.map((up: any) => (
                  <EvidenceItem key={up.id} src={up.fileUrl} label={up.fileType || stage} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function SiteVisitDetail({ visit, onClose }: { visit: SiteVisit; onClose: () => void }) {
  const { startSiteVisit, uploadSiteVisitPhoto, addSiteVisitEvidence, uploadEvidenceFile, completeSiteVisit, stockItems, projects } = useApp()
  const { employee } = useAuth()

  const linkedProject = projects.find(p => p.id === visit.projectId)

  const [noteDraft, setNoteDraft] = useState('')
  const [showCamera, setShowCamera] = useState(false)

  const customerLat = visit.customerLatitude ?? undefined
  const customerLng = visit.customerLongitude ?? undefined

  const isFieldWorker = employee?.designation === 'Site Visitor'

  const { currentLocation, distance, error: gpsError, getFreshLocation, lastUpdated, wsStatus } = useSiteVisitTracking(
    visit.id,
    visit.status === 'In Progress', 
    isFieldWorker,
    customerLat,
    customerLng
  )

  // Force re-render every 5 seconds to update stale status if not field worker
  const [, setTick] = useState(0)
  useEffect(() => {
    if (visit.status !== 'In Progress' || isFieldWorker) return
    const timer = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(timer)
  }, [visit.status, isFieldWorker])

  const handleStartVisit = async () => {
    try {
      const { location } = await getFreshLocation()
      
      if (location.accuracy > 5000) {
        setFormError(`GPS accuracy is too low (${Math.round(location.accuracy)}m). Please move to an open area and try again.`)
        return
      }
      
      // Allow start
      startSiteVisit(visit.id, location.latitude, location.longitude, location.accuracy)
    } catch (err: any) {
      setFormError('Location permission is required to start a Site Visit. Please allow location access in your browser settings.')
    }
  }

  const handleCameraUpload = async (blob: Blob, lat: number, lng: number, accuracy: number) => {
    try {
      await uploadSiteVisitPhoto(visit.id, blob, lat, lng, accuracy)
    } catch (err: any) {
      setFormError('Failed to upload photo: ' + err.message)
    }
  }

  const [installationArea, setInstallationArea] = useState(visit.installationArea ?? '')
  const [measurements, setMeasurements] = useState(visit.measurements ?? '')
  const [roofGroundDetails, setRoofGroundDetails] = useState(visit.roofGroundDetails ?? '')
  const rawMaterials = visit.rawMaterials ?? ''
  const [rawMaterialDetails, setRawMaterialDetails] = useState<{ itemId: string; itemName: string; quantity: number }[]>(visit.rawMaterialDetails ?? [])
  const [cableAccessories, setCableAccessories] = useState(visit.cableAccessories ?? '')
  const [resultNotes, setResultNotes] = useState(visit.notes ?? '')
  const [feasibility, setFeasibility] = useState<FeasibilityResult | ''>('')
  const [rejectionReason, setRejectionReason] = useState<LostReason | ''>('')
  const [rejectionRemarks, setRejectionRemarks] = useState('')
  const [formError, setFormError] = useState('')

  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const measurementRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)


  function handleFile(kind: 'photo' | 'video' | 'measurementImage' | 'document') {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        await uploadEvidenceFile(visit.id, file, kind)
      } catch (err: any) {
        setFormError(`Failed to upload ${kind}: ` + err.message)
      }
      e.target.value = ''
    }
  }



  function addNote() {
    if (!noteDraft.trim()) return
    addSiteVisitEvidence(visit.id, { note: noteDraft.trim() })
    setNoteDraft('')
  }

  function submitResult(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!feasibility) { setFormError('Select a feasibility result to complete this visit.') }
    const needsRejection = feasibility === 'Not Feasible' || feasibility === 'Customer Requirement Not Supported'
    if (needsRejection && (!rejectionReason || !rejectionRemarks.trim())) {
      setFormError('Reason and remarks are mandatory for a Not Feasible / requirement-not-supported result.')
      return
    }
    if (feasibility === 'Revisit Required' && !rejectionRemarks.trim()) {
      setFormError('Add remarks explaining why a revisit is required.')
      return
    }
    if (!feasibility) return
    completeSiteVisit(visit.id, {
      feasibilityResult: feasibility,
      installationArea, measurements, roofGroundDetails, rawMaterials, rawMaterialDetails, cableAccessories, notes: resultNotes,
      rejectionReason: needsRejection ? (rejectionReason || undefined) : undefined,
      rejectionRemarks: (needsRejection || feasibility === 'Revisit Required') ? rejectionRemarks : undefined,
    })
    onClose()
  }

  const totalEvidence = (visit.photos?.length || 0) + (visit.sitePhotos?.length || 0) + (visit.videos?.length || 0) + (visit.measurementImages?.length || 0) + (visit.documents?.length || 0)

  return (
    <Modal title={`Site Visit — ${visit.customerName}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div className="text-xs text-text-dim">Visit ID <span className="font-mono text-teal">{visit.id}</span></div>
          <Pill status={visit.status} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-text-dim">Customer</div><div className="font-medium">{visit.customerName}</div></div>
          <div><div className="text-xs text-text-dim">Mobile</div><div className="font-medium">{visit.customerMobile}</div></div>
          <div><div className="text-xs text-text-dim">Site Address</div><div className="font-medium">{visit.siteAddress}, {visit.area}</div></div>
          <div>
            <div className="text-xs text-text-dim">Coordinates</div>
            <div className="font-mono text-xs text-text-dim mt-1">
              {visit.customerLatitude?.toFixed(6) ?? '—'}, {visit.customerLongitude?.toFixed(6) ?? '—'}
            </div>
          </div>
          <div><div className="text-xs text-text-dim">Visit Date / Time</div><div className="font-medium">{formatDate(visit.visitDate)} · {visit.visitTime}</div></div>
          <div><div className="text-xs text-text-dim">Employee</div><div className="font-medium">{visit.employeeName}</div></div>
          <div><div className="text-xs text-text-dim">Site Type</div><div className="font-medium">{visit.siteType}</div></div>
          <div><div className="text-xs text-text-dim">Product Requirement</div><div className="font-medium">{visit.productRequirement ?? '—'} ({visit.estimatedCapacity ?? '—'})</div></div>
        </div>

        {visit.status === 'Upcoming' && employee?.id === visit.employeeId && (
          <div className="flex flex-col items-end gap-2">
            {formError && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2 max-w-sm">{formError}</div>}
            <button onClick={handleStartVisit} className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors flex items-center gap-1.5">
              <Play size={13} /> Start Site Visit
            </button>
          </div>
        )}

        {visit.status === 'In Progress' && (
          <>
            <Card className="p-4 space-y-3">
              {isFieldWorker ? (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Live Field Tracking</div>
                    <div className="flex items-center gap-2 bg-teal/10 px-2 py-1 rounded-full border border-teal/20">
                      <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
                      <span className="text-[10px] text-teal font-medium uppercase tracking-wide">Site Visit In Progress</span>
                    </div>
                  </div>
                  
                  {gpsError && <div className="text-xs text-rose bg-rose/10 px-2 py-1 rounded mb-2">{gpsError}</div>}
                  
                  {currentLocation ? (
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center bg-black/[0.02] border border-border p-2 rounded">
                         <span className="text-xs text-text-dim">Location Status</span>
                         <span className="text-xs font-medium text-teal flex items-center gap-1"><CheckCircle2 size={12}/> Tracking Active</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/[0.02] border border-border p-2 rounded">
                          <div className="text-[10px] text-text-dim uppercase tracking-wide mb-1">GPS Accuracy</div>
                          <div className="font-medium text-sm">{Math.round(currentLocation.accuracy)} meters</div>
                        </div>
                        <div className="bg-black/[0.02] border border-border p-2 rounded">
                          <div className="text-[10px] text-text-dim uppercase tracking-wide mb-1">Last Updated</div>
                          <div className="font-medium text-sm">{lastUpdated ? lastUpdated.toLocaleTimeString() : 'Just now'}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-text-dim flex items-center gap-2 p-3 bg-black/[0.02] border border-border rounded mb-4">
                      <div className="w-3 h-3 rounded-full border-2 border-teal border-t-transparent animate-spin" />
                      Acquiring high-accuracy GPS location…
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <input className={inputCls} placeholder="Add a site observation note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                    <button onClick={addNote} className="text-xs font-medium px-3 py-2 rounded-lg bg-panel-raised border border-border hover:bg-black/[0.03] transition-colors whitespace-nowrap">Add Note</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Live Field Tracking</div>
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-full border ${wsStatus === 'disconnected' ? 'bg-rose/10 border-rose/20' : (!lastUpdated || Date.now() - lastUpdated.getTime() > 30000) ? 'bg-sun/10 border-sun/20' : 'bg-teal/10 border-teal/20'}`}>
                      {wsStatus === 'disconnected' ? (
                         <>
                           <div className="w-2 h-2 rounded-full bg-rose" />
                           <span className="text-[10px] text-rose font-medium uppercase tracking-wide">OFFLINE</span>
                         </>
                      ) : lastUpdated && Date.now() - lastUpdated.getTime() > 30000 ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-sun" />
                          <span className="text-[10px] text-sun font-medium uppercase tracking-wide">LOCATION SIGNAL STALE</span>
                        </>
                      ) : currentLocation ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
                          <span className="text-[10px] text-teal font-medium uppercase tracking-wide">LIVE</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full bg-border" />
                          <span className="text-[10px] text-text-dim font-medium uppercase tracking-wide">WAITING FOR WORKER</span>
                        </>
                      )}
                    </div>
                  </div>

                  {currentLocation && lastUpdated && wsStatus === 'connected' && Date.now() - lastUpdated.getTime() <= 30000 && (
                    <div className="text-xs font-medium text-teal flex items-center gap-1.5 mb-2">
                       <span className="w-1.5 h-1.5 bg-teal rounded-full animate-pulse" />
                       Field Worker is moving · Updated {lastUpdated.toLocaleTimeString()}
                    </div>
                  )}
                  {gpsError && <div className="text-xs text-rose bg-rose/10 px-2 py-1 rounded mb-2">{gpsError}</div>}

                  <div className="border border-border rounded-lg overflow-hidden h-[400px] bg-black/[0.02]">
                    <MapContainer center={customerLat && customerLng ? [customerLat, customerLng] : (currentLocation ? [currentLocation.latitude, currentLocation.longitude] : [10.7905, 78.7047])} zoom={customerLat ? 16 : 13} style={{ height: '100%', width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {customerLat && customerLng && (
                        <Marker position={[customerLat, customerLng]}>
                          <Popup>
                            <strong>Customer Site</strong><br/>
                            {visit.customerName}<br/>
                            {visit.siteAddress}
                          </Popup>
                        </Marker>
                      )}
                      <LiveWorkerMarker location={currentLocation} employeeName={visit.employeeName} />
                    </MapContainer>
                  </div>
                </>
              )}
            </Card>

            {employee?.id === visit.employeeId && (
              <>
                <Card className="p-4 space-y-3">
                  <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Evidence Capture {totalEvidence > 0 && <span className="text-teal">· {totalEvidence} captured</span>}</div>
                  <div className="flex flex-wrap gap-2">
                    <EvidenceRow label="Site Photo" icon={Camera} count={(visit.photos?.length || 0) + (visit.sitePhotos?.length || 0)} onPick={() => setShowCamera(true)} accept="image/*" capture />
                    <EvidenceRow label="Site Video" icon={Video} count={visit.videos?.length || 0} onPick={() => videoRef.current?.click()} accept="video/*" capture />
                    <EvidenceRow label="Measurement Image" icon={FileImage} count={visit.measurementImages?.length || 0} onPick={() => measurementRef.current?.click()} accept="image/*" capture />
                <EvidenceRow label="Document" icon={FileText} count={visit.documents?.length || 0} onPick={() => docRef.current?.click()} accept="image/*,.pdf" />
              </div>
              <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile('photo')} />
              <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleFile('video')} />
              <input ref={measurementRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile('measurementImage')} />
              <input ref={docRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile('document')} />
            </Card>

            <EvidenceGallery visit={visit} />

            {visit.siteType === 'Project Installation' ? (
              <ProjectStagesGallery visit={visit} />
            ) : (
              <Card className="p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Site Visit Form</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Installation Area"><input className={inputCls} value={installationArea} onChange={(e) => setInstallationArea(e.target.value)} placeholder="e.g. South-facing terrace, 280 sq ft" /></Field>
                  <Field label="Measurements"><input className={inputCls} value={measurements} onChange={(e) => setMeasurements(e.target.value)} placeholder="Roof length x width, parapet height" /></Field>
                  <Field label="Roof / Ground Details"><input className={inputCls} value={roofGroundDetails} onChange={(e) => setRoofGroundDetails(e.target.value)} placeholder="Structure type, condition, shading" /></Field>
                  <div className="col-span-full space-y-2">
                    <div className="text-[10px] font-medium text-text-dim uppercase tracking-wider">Raw Materials Needed</div>
                    {rawMaterialDetails.map((rm, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <select className={inputCls} value={rm.itemId} onChange={(e) => {
                          const item = stockItems.find((s: any) => s.id === e.target.value)
                          const updated = [...rawMaterialDetails]
                          updated[i] = { ...updated[i], itemId: item?.id || '', itemName: item?.productName || '' }
                          setRawMaterialDetails(updated)
                        }}>
                          <option value="">— Select Product —</option>
                          {stockItems.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.productName}{s.model ? ` (${s.model})` : ''}{s.category ? ` · ${s.category}` : ''}
                            </option>
                          ))}
                        </select>
                        <input type="number" className={`${inputCls} w-24`} placeholder="Qty" value={rm.quantity || ''} onChange={(e) => {
                           const updated = [...rawMaterialDetails]
                           updated[i].quantity = parseInt(e.target.value) || 0
                           setRawMaterialDetails(updated)
                        }} />
                        <button type="button" onClick={() => setRawMaterialDetails(rawMaterialDetails.filter((_, idx) => idx !== i))} className="text-rose hover:bg-rose/10 p-1.5 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setRawMaterialDetails([...rawMaterialDetails, { itemId: '', itemName: '', quantity: 1 }])} className="text-xs font-medium text-teal hover:underline flex items-center gap-1">
                      <Plus size={12} /> Add Product
                    </button>
                  </div>
                  <Field label="Cable / Pipe / Accessories"><input className={inputCls} value={cableAccessories} onChange={(e) => setCableAccessories(e.target.value)} placeholder="DC cable length, connectors, earthing" /></Field>
                  <Field label="Notes"><input className={inputCls} value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} placeholder="Any additional observations" /></Field>
                </div>
              </Card>
            )}

            {visit.siteType !== 'Project Installation' && (
              <Card className="p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Feasibility Result</div>
              <form onSubmit={submitResult} className="space-y-3">
                <Field label="Result">
                  <select className={inputCls} value={feasibility} onChange={(e) => setFeasibility(e.target.value as FeasibilityResult)}>
                    <option value="">— Select result —</option>
                    {FEASIBILITY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                {(feasibility === 'Not Feasible' || feasibility === 'Customer Requirement Not Supported') && (
                  <Field label="Rejection Reason">
                    <select className={inputCls} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value as LostReason)}>
                      <option value="">— Select reason —</option>
                      {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                )}
                {(feasibility === 'Not Feasible' || feasibility === 'Customer Requirement Not Supported' || feasibility === 'Revisit Required') && (
                  <Field label="Remarks (proof / evidence should be attached above)">
                    <textarea className={`${inputCls} min-h-[70px]`} value={rejectionRemarks} onChange={(e) => setRejectionRemarks(e.target.value)} placeholder="Mandatory remarks explaining the result" />
                  </Field>
                )}
                {formError && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{formError}</div>}
                <div className="flex justify-end">
                  <button type="submit" className="bg-sun text-ink text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sun-deep transition-colors flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Submit Visit Result
                  </button>
                </div>
              </form>
            </Card>
            )}
          </>
        )}
          </>
        )}

        {(visit.status === 'Completed' || visit.status === 'Revisit Required' || visit.status === 'Rejected') && (
          <>
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium">Feasibility Result</div>
                {visit.feasibilityResult && <Pill status={visit.feasibilityResult} />}
              </div>
              {visit.rejectionReason && <div className="text-sm"><span className="text-text-dim">Reason: </span>{visit.rejectionReason}</div>}
              {visit.rejectionRemarks && <div className="text-sm"><span className="text-text-dim">Remarks: </span>{visit.rejectionRemarks}</div>}
              <div className="text-xs text-text-dim">Completed on {formatDate(visit.completedOn ?? '')}</div>
            </Card>
            <Card className="p-4 space-y-2 text-sm">
              <div className="text-[11px] uppercase tracking-wide text-text-dim font-medium mb-1">Site Details Captured</div>
              {visit.installationArea && <div><span className="text-text-dim">Installation Area: </span>{visit.installationArea}</div>}
              {visit.measurements && <div><span className="text-text-dim">Measurements: </span>{visit.measurements}</div>}
              {visit.roofGroundDetails && <div><span className="text-text-dim">Roof / Ground: </span>{visit.roofGroundDetails}</div>}
              {visit.rawMaterials && <div><span className="text-text-dim">Raw Materials Notes: </span>{visit.rawMaterials}</div>}
              {visit.rawMaterialDetails && visit.rawMaterialDetails.length > 0 && (
                <div>
                  <span className="text-text-dim">Products Selected: </span>
                  <ul className="list-disc pl-4 mt-1">
                    {visit.rawMaterialDetails.map((rm, i) => (
                      <li key={i}>{rm.itemName} (Qty: {rm.quantity})</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-xs">
                    <span className="text-text-dim">Stock Status: </span>
                    <span className={`font-medium ${visit.stockAvailabilityStatus === 'Available' ? 'text-teal' : 'text-sun'}`}>
                      {visit.stockAvailabilityStatus || 'Pending Check'}
                    </span>
                  </div>
                </div>
              )}
              {visit.cableAccessories && <div><span className="text-text-dim">Cable / Accessories: </span>{visit.cableAccessories}</div>}
              {visit.notes && <div><span className="text-text-dim">Notes: </span>{visit.notes}</div>}
            </Card>
            <EvidenceGallery visit={visit} />
            {visit.siteType !== 'Final Review' && <ProjectStagesGallery visit={visit} project={linkedProject} />}
          </>
        )}
      </div>
      
      {showCamera && (
        <SiteVisitCameraModal
          onClose={() => setShowCamera(false)}
          onUpload={handleCameraUpload}
          customerName={visit.customerName}
          customerAddress={visit.siteAddress}
          customerLat={customerLat ?? 0}
          customerLng={customerLng ?? 0}
          fastLocation={currentLocation}
          fastDistance={distance}
        />
      )}
    </Modal>
  )
}
