import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, Pill, Modal } from '../../components/shared/Primitives'
import type { Project } from '../../types/models'
import { ArrowLeft, Camera, CheckCircle2, Play, Navigation2, Download, Wrench, Send, Lock, AlertTriangle } from 'lucide-react'
import { siteVisitsApi } from '../../api/siteVisits'

// ─── helpers ────────────────────────────────────────────────────────────────

function imgUrl(src: string) {
  if (!src) return ''
  if (src.startsWith('/uploads')) return `http://localhost:8000${src}`
  return src
}

function EvidenceItem({ src }: { src: string }) {
  const url = imgUrl(src)
  return (
    <a href={url} target="_blank" rel="noreferrer" download
      className="group relative block w-14 h-14 rounded-lg overflow-hidden border border-border bg-black/[0.02]">
      <img src={url} alt="Evidence" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        <Download size={14} />
      </div>
    </a>
  )
}

// ─── Camera / Capture helper ─────────────────────────────────────────────────

function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number; acc: number } | null>(null)

  // Attach stream to video element whenever stream changes or video ref becomes available
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const start = async (onError: (msg: string) => void) => {
    try {
      // get GPS (non-blocking: fallback to 0,0)
      let lat = 0, lng = 0, acc = 9999
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
          const t = setTimeout(() => rej(new Error('GPS timeout')), 6000)
          navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res(p) }, e => { clearTimeout(t); rej(e) }, { enableHighAccuracy: true, timeout: 6000 })
        })
        lat = pos.coords.latitude; lng = pos.coords.longitude; acc = pos.coords.accuracy
      } catch { /* no GPS, continue */ }
      setLocation({ lat, lng, acc })

      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(s)
      setActive(true)
    } catch (e: any) {
      onError('Camera access denied. Please allow camera in browser settings.')
    }
  }

  const stop = () => {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    setActive(false)
  }

  const capture = async (watermarkText: string): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    // watermark
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, canvas.height - 56, canvas.width, 56)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 13px Arial'
    ctx.fillText(watermarkText, 10, canvas.height - 34)
    ctx.font = '12px Arial'
    ctx.fillText(`${new Date().toLocaleString()} | ${location ? `${location.lat.toFixed(5)},${location.lng.toFixed(5)}` : 'No GPS'}`, 10, canvas.height - 12)
    return new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85))
  }

  return { videoRef, canvasRef, stream, active, location, start, stop, capture }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TechnicianSiteVisitDetail({ project, onBack, visitId }: { project: Project; onBack: () => void; visitId?: string }) {
  const { siteVisits, createProjectSiteVisit, startSiteVisit, completeSiteVisitStage, refreshSiteVisits, refreshProjects } = useApp()
  
  const visit = visitId 
    ? siteVisits.find(v => v.id === visitId)
    : siteVisits.filter(v => v.projectId === project.id && v.siteType !== 'Final Review')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]


  const [stages, setStages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Camera context: which action triggered the camera
  const [cameraCtx, setCameraCtx] = useState<{ type: 'stage'; stage: string } | { type: 'tool'; kind: 'before' | 'after' } | null>(null)

  const cam = useCameraCapture()

  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 6000) }
  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000) }

  // Load stages from backend
  useEffect(() => {
    const sysType = (project as any).systemType || 'ON-GRID'
    siteVisitsApi.getProjectStages(sysType)
      .then(res => setStages(res))
      .catch(() => setStages(['Structure Erection', 'Electrical Work', 'Panel Mounting', 'DC Wiring Work', 'Earthing and Lightning Arrestor', 'Inverter Installation']))
  }, [project.id])

  // ── Start Visit ────────────────────────────────────────────────────────────
  const handleStartVisit = async () => {
    setError('')
    setIsLoading(true)
    try {
      let latitude = 0, longitude = 0, accuracy = 9999
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('GPS timed out')), 8000)
          navigator.geolocation.getCurrentPosition(
            p => { clearTimeout(timer); resolve(p) },
            e => { clearTimeout(timer); reject(e) },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          )
        })
        latitude = pos.coords.latitude; longitude = pos.coords.longitude; accuracy = pos.coords.accuracy
      } catch { /* GPS failed — continue without */ }

      let vId = visit?.id
      if (!vId) {
        const newVisit = await createProjectSiteVisit(
          project.id, project.customerName, (project as any).customerMobile || '',
          'ON-GRID', project.site || '', latitude, longitude
        )
        if (!newVisit) throw new Error('Failed to create site visit record in database')
        vId = newVisit.id
      }
      await startSiteVisit(vId!, latitude, longitude, accuracy)
      showSuccess('Site visit started!')
    } catch (err: any) {
      showError(err.message || 'Failed to start visit.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Open Camera ────────────────────────────────────────────────────────────
  const openCamera = async (ctx: typeof cameraCtx) => {
    setCameraCtx(ctx)
    await cam.start(showError)
  }

  const closeCamera = () => { cam.stop(); setCameraCtx(null) }

  // ── Capture & Upload ───────────────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraCtx) return
    setIsLoading(true)
    try {
      let label = ''
      if (cameraCtx.type === 'stage') label = `${project.customerName} - ${cameraCtx.stage}`
      else label = `${project.customerName} - Tools ${cameraCtx.kind === 'before' ? 'Before' : 'After'} Work`

      const blob = await cam.capture(label)
      if (!blob) throw new Error('Failed to capture image')

      if (visit) {
        if (cameraCtx.type === 'tool') {
          await siteVisitsApi.uploadToolPhoto(visit.id, blob, cameraCtx.kind)
        } else if (cameraCtx.type === 'stage') {
          await siteVisitsApi.uploadPhoto(
            visit.id,
            blob,
            cam.location?.lat || 0,
            cam.location?.lng || 0,
            cam.location?.acc || 9999,
            cameraCtx.stage
          )
        }
        await refreshSiteVisits()
      } else {
        throw new Error("No active site visit to upload photo to.")
      }

      await refreshProjects()
      showSuccess('Photo uploaded successfully!')
      closeCamera()
    } catch (err: any) {
      showError(err.message || 'Upload failed')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Complete Stage ─────────────────────────────────────────────────────────
  const handleCompleteStage = async (stage: string) => {
    if (!visit) return
    setIsLoading(true)
    try {
      await completeSiteVisitStage(visit.id, stage)
      showSuccess(`Stage "${stage}" marked complete!`)
    } catch (err: any) {
      showError(err.message || 'Failed to complete stage')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Submit Visit ───────────────────────────────────────────────────────────
  const handleSubmitVisit = async () => {
    if (!visit) return
    setIsLoading(true)
    try {
      if (isFinalReview && feedback.trim()) {
        await siteVisitsApi.addEvidence(visit.id, { note: `Customer Feedback: ${feedback.trim()}` })
      }
      await siteVisitsApi.submitVisit(visit.id)
      await refreshSiteVisits()
      showSuccess('Site visit submitted successfully! Project Head has been notified.')
    } catch (err: any) {
      showError(err.message || 'Submission failed. Check all requirements.')
    } finally {
      setIsLoading(false)
    }
  }

  const isFinalReview = visit?.siteType === 'Final Review'
  const completedStages = visit?.completedStages || []
  const isSubmitted = !!visit?.submittedAt
  const isInProgress = visit?.status === 'In Progress'

  // Submit readiness check
  const allStagesDone = isFinalReview || (stages.length > 0 && stages.every(s => completedStages.includes(s)))
  const hasFeedback = isFinalReview ? !!(visit?.notes || feedback.trim()) : true
  
  const toolBefore = visit?.toolPhotoBefore ? { fileUrl: visit.toolPhotoBefore, id: 'v-before', fileType: 'Site Photo Before' } : null
  const toolAfter = visit?.toolPhotoAfter ? { fileUrl: visit.toolPhotoAfter, id: 'v-after', fileType: 'Site Photo After' } : null
  
  const hasToolBefore = !!toolBefore
  const hasToolAfter = !!toolAfter
  const canSubmit = isInProgress && !isSubmitted && allStagesDone && hasToolBefore && hasToolAfter && hasFeedback

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-black/5 text-text-dim hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-dim">Site Visit</div>
          <h1 className="text-xl font-bold font-display truncate">{project.customerName}</h1>
        </div>
        {isSubmitted && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal bg-teal/10 px-3 py-1.5 rounded-full">
            <Lock size={12} /> Submitted
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-rose bg-rose/10 border border-rose/30 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 text-sm text-teal bg-teal/10 border border-teal/20 rounded-lg px-4 py-3">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Project Info Card */}
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-text-dim mb-1">System Type</div><div className="font-medium">ON-GRID {project.capacityKw}kW</div></div>
          <div><div className="text-text-dim mb-1">Status</div><div className="font-medium"><Pill status={visit?.status || 'Not Started'} /></div></div>
          <div className="col-span-2"><div className="text-text-dim mb-1">Location</div><div className="font-medium">{project.site}</div></div>
        </div>

        {(!visit || visit.status === 'Upcoming') && (
          <button onClick={handleStartVisit} disabled={isLoading}
            className="w-full bg-emerald-600 text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-emerald-700 shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50">
            <Play size={16} /> {isLoading ? 'Starting…' : 'Start Site Visit'}
          </button>
        )}
      </Card>

      {visit && (
        <>
          {/* ── Photos Section ──────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wrench size={16} className={isFinalReview ? 'text-teal' : 'text-sun'} />
              <span className={`text-sm font-semibold uppercase tracking-wide ${isFinalReview ? 'text-teal' : 'text-sun'}`}>
                {isFinalReview ? 'Site Photos' : 'Tools / Equipment'}
              </span>
            </div>

            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Before Work / Site Photo 1 */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-dim">
                    {isFinalReview ? "Site Photo 1" : "Before Work"}
                  </div>
                  {hasToolBefore ? (
                    <div className="space-y-2">
                      <EvidenceItem src={toolBefore!.fileUrl} />
                      <div className="text-xs text-teal flex items-center gap-1"><Lock size={10} /> Uploaded</div>
                    </div>
                  ) : (
                    !isSubmitted && isInProgress && (
                      <button onClick={() => openCamera({ type: 'tool', kind: 'before' })}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-panel-raised border border-border rounded-lg hover:bg-black/5 w-full justify-center">
                        <Camera size={13} /> Take Photo
                      </button>
                    )
                  )}
                  {!hasToolBefore && !isInProgress && (
                    <div className="text-xs text-text-dim italic">Not uploaded</div>
                  )}
                </div>

                {/* After Work / Site Photo 2 */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-dim">
                    {isFinalReview ? "Site Photo 2" : "After Work"}
                  </div>
                  {hasToolAfter ? (
                    <div className="space-y-2">
                      <EvidenceItem src={toolAfter!.fileUrl} />
                      <div className="text-xs text-teal flex items-center gap-1"><Lock size={10} /> Uploaded</div>
                    </div>
                  ) : (
                    !isSubmitted && isInProgress && (
                      <button onClick={() => openCamera({ type: 'tool', kind: 'after' })}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-panel-raised border border-border rounded-lg hover:bg-black/5 w-full justify-center">
                        <Camera size={13} /> Take Photo
                      </button>
                    )
                  )}
                  {!hasToolAfter && !isInProgress && (
                    <div className="text-xs text-text-dim italic">Not uploaded</div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* ── Installation Stages ───────────────────────────────────────────── */}
          {!isFinalReview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Navigation2 size={16} className="text-teal" />
                <span className="text-sm font-semibold uppercase tracking-wide text-teal">Installation Stages</span>
              </div>

              {stages.map((stage, idx) => {
                const isCompleted = completedStages.includes(stage)
                const visitPhotos = visit?.photos?.filter((p: any) => p.stage === stage) || []
                const projectPhotos = project.uploads?.filter(p => p.stage === stage) || []
                const hasPhotos = visitPhotos.length > 0 || projectPhotos.length > 0
                const photoCount = visitPhotos.length + projectPhotos.length
                
                return (
                  <Card key={stage} className={`p-4 transition-colors ${isCompleted ? 'bg-teal/5 border-teal/20' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center text-xs font-bold text-text-dim shrink-0">
                            {isCompleted ? <CheckCircle2 size={14} className="text-teal" /> : idx + 1}
                          </div>
                          <h3 className="font-semibold text-text text-sm">{stage}</h3>
                        </div>
                        {hasPhotos && (
                          <div className="pl-8 flex flex-wrap gap-1.5">
                            {visitPhotos.map((p: any) => <EvidenceItem key={p.id} src={p.filePath} />)}
                            {projectPhotos.map(p => <EvidenceItem key={p.id} src={p.fileUrl} />)}
                          </div>
                        )}
                      </div>

                      {!isSubmitted && isInProgress && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-1 text-teal text-xs font-medium px-2 py-1.5 bg-teal/10 rounded-lg">
                              <CheckCircle2 size={13} /> Done
                            </div>
                          ) : (
                            <>
                              <button onClick={() => openCamera({ type: 'stage', stage })}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-panel-raised border border-border rounded-lg hover:bg-black/5">
                                <Camera size={12} /> Photo {photoCount > 0 && `(${photoCount})`}
                              </button>
                              <button onClick={() => handleCompleteStage(stage)}
                                disabled={isLoading || !hasPhotos}
                                title={!hasPhotos ? 'Upload at least one photo first' : ''}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg shadow-xs hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <CheckCircle2 size={12} /> Complete
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {isSubmitted && isCompleted && (
                        <div className="text-xs text-teal font-medium flex items-center gap-1">
                          <CheckCircle2 size={13} /> Done
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ── Customer Feedback (Final Review) ───────────────────────────────────────────── */}
          {isFinalReview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-teal" />
                <span className="text-sm font-semibold uppercase tracking-wide text-teal">Customer Feedback</span>
              </div>
              <Card className="p-4">
                {isSubmitted ? (
                  <div className="text-sm text-text whitespace-pre-wrap">{visit.notes || 'No feedback recorded.'}</div>
                ) : (
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Enter customer feedback or remarks..."
                    className="w-full text-sm bg-panel-raised border border-border rounded-lg p-3 outline-none focus:border-sun transition-colors min-h-[100px]"
                  />
                )}
              </Card>
            </div>
          )}

          {/* ── Submit Visit ─────────────────────────────────────────────────── */}
          {isInProgress && !isSubmitted && (
            <Card className="p-5 space-y-3">
              <div className="text-sm font-semibold text-text">Submit Site Visit</div>
              <div className="space-y-1.5 text-xs text-text-dim">
                <div className={`flex items-center gap-2 ${hasToolBefore ? 'text-teal' : ''}`}>
                  {hasToolBefore ? <CheckCircle2 size={13} /> : <div className="w-3 h-3 rounded-full border border-text-dim/50" />}
                  {isFinalReview ? 'Before-work site photo' : 'Before-work tool photo'}
                </div>
                <div className={`flex items-center gap-2 ${hasToolAfter ? 'text-teal' : ''}`}>
                  {hasToolAfter ? <CheckCircle2 size={13} /> : <div className="w-3 h-3 rounded-full border border-text-dim/50" />}
                  {isFinalReview ? 'After-work site photo' : 'After-work tool photo'}
                </div>
                {!isFinalReview && (
                  <div className={`flex items-center gap-2 ${allStagesDone ? 'text-teal' : ''}`}>
                    {allStagesDone ? <CheckCircle2 size={13} /> : <div className="w-3 h-3 rounded-full border border-text-dim/50" />}
                    All installation stages completed ({completedStages.length}/{stages.length})
                  </div>
                )}
                {isFinalReview && (
                  <div className={`flex items-center gap-2 ${hasFeedback ? 'text-teal' : ''}`}>
                    {hasFeedback ? <CheckCircle2 size={13} /> : <div className="w-3 h-3 rounded-full border border-text-dim/50" />}
                    Customer feedback recorded
                  </div>
                )}
              </div>
              <button
                onClick={handleSubmitVisit}
                disabled={!canSubmit || isLoading}
                className="w-full bg-teal text-white text-sm font-semibold px-4 py-3 rounded-lg hover:bg-teal/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Send size={16} /> {isLoading ? 'Submitting…' : 'Submit Site Visit'}
              </button>
              {!canSubmit && (
                <p className="text-xs text-text-dim text-center">Complete all stages and upload both tool photos to submit</p>
              )}
            </Card>
          )}

          {isSubmitted && (
            <Card className="p-5 flex items-center gap-3 bg-teal/5 border-teal/20">
              <div className="w-10 h-10 rounded-xl bg-teal/15 flex items-center justify-center shrink-0">
                <Lock size={20} className="text-teal" />
              </div>
              <div>
                <div className="font-semibold text-teal text-sm">Site Visit Submitted</div>
                <div className="text-xs text-text-dim">Awaiting Project Head review. No further edits allowed.</div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Camera Modal ───────────────────────────────────────────────────── */}
      {cameraCtx && (
        <Modal
          title={cameraCtx.type === 'stage' ? `Photo — ${cameraCtx.stage}` : `Tools ${cameraCtx.kind === 'before' ? 'Before' : 'After'} Work`}
          onClose={closeCamera}
          wide
        >
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
              <video ref={cam.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={cam.canvasRef} className="hidden" />
              {!cam.stream && <div className="absolute text-white text-sm">Starting camera…</div>}
            </div>
            {cam.location && (
              <div className="text-xs text-text-dim text-center">
                GPS: {cam.location.lat.toFixed(5)}, {cam.location.lng.toFixed(5)} (±{Math.round(cam.location.acc)}m)
              </div>
            )}
            <button onClick={handleCapture} disabled={isLoading || !cam.stream}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold shadow-xs hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 transition">
              <Camera size={18} /> {isLoading ? 'Uploading…' : 'Capture & Upload'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
