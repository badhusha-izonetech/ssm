import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { StageArc } from '../../components/shared/StageArc'
import { Pagination } from '../../components/shared/Pagination'
import { formatDate } from '../../lib/utils'
import { CheckCircle2, Circle, Camera, Wrench, Download } from 'lucide-react'
import { useState, useMemo } from 'react'

function imgUrl(src: string) {
  if (!src) return ''
  if (src.startsWith('/uploads')) return `http://localhost:8000${src}`
  return src
}

function EvidenceItem({ src, label }: { src: string, label?: string }) {
  const url = imgUrl(src)
  return (
    <a href={url} target="_blank" rel="noreferrer" title={label}
      className="group relative block w-12 h-12 rounded-lg overflow-hidden border border-border bg-black/[0.02] shrink-0">
      <img src={url} alt="Evidence" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        <Download size={14} />
      </div>
    </a>
  )
}

export default function CompletionMonitoring() {
  const { projects, siteVisits, ebApplications } = useApp()

  const monitored = projects.filter((p) => {
    // Show if project has reached installation stages (original behavior)
    if (p.currentStage === 'Installation' || p.currentStage === 'Final Connection' || p.currentStage === 'Completed') return true
    // Show as soon as a technician or document follow-up employee is assigned
    if (p.assignedTechnicianId || p.assignedDocEmployeeId) return true
    // Show if installation or EB work has started
    if (p.installationStatus !== 'Not Started' || (p.ebStatus !== 'Not Started')) return true
    return false
  })

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedMonitored = useMemo(() => monitored.slice((currentPage - 1) * 25, currentPage * 25), [monitored, currentPage])

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Project → Project Head" title="Completion Monitoring" action={<span className="text-xs text-text-dim">{monitored.length} project(s)</span>} />

      {monitored.length === 0 ? (
        <EmptyState title="Nothing to monitor yet" message="Projects will appear here as soon as a technician or document follow-up employee is assigned and starts work." />
      ) : (
        <div className="flex flex-col gap-3">
          {paginatedMonitored.map((p) => {
            const ebApp = ebApplications.find((e) => e.projectId === p.id)
            const checks = [
              { label: 'EB application assigned', done: !!ebApp },
              { label: 'EB documents verified', done: ebApp?.verificationStatus === 'VERIFIED' },
              { label: 'EB portal submitted', done: ebApp?.portalSubmissionStatus === 'COMPLETED' },
              { label: 'EB meter handover completed', done: ebApp?.handoverStatus === 'COMPLETED' || p.ebStatus === 'Meter Installed' || p.ebStatus === 'Connected' },
              { label: 'Installation completed', done: p.installationStatus === 'Completed' },
              { label: '100% payment verified', done: p.balanceAmount === 0 },
              { label: 'Customer review submitted', done: siteVisits.some(v => v.projectId === p.id && v.siteType === 'Final Review' && v.submittedAt) },
            ]
            const allDone = checks.every((c) => c.done)
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-medium text-sm text-text">{p.projectCode} — {p.customerName}</div>
                    <div className="text-xs text-text-dim mt-0.5">{p.site} · Due {formatDate(p.dueDate)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Pill status={p.status} />
                    <StageArc stage={p.currentStage} size="sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {checks.map((c) => (
                    <div key={c.label} className={`flex items-center gap-2 text-xs ${c.done ? 'text-teal' : 'text-text-dim'}`}>
                      {c.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      {c.label}
                    </div>
                  ))}
                </div>
                {allDone && p.currentStage !== 'Completed' && (
                  <div className="mt-3 text-xs font-medium text-teal bg-teal/10 border border-teal/30 rounded-lg px-3 py-2">
                    All conditions met — ready for final connection and project closure.
                  </div>
                )}

                {/* Technician Evidence */}
                {(() => {
                  const visits = siteVisits.filter(v => {
                    if (v.projectId !== p.id) return false
                    // Show submitted visits
                    if (v.submittedAt) return true
                    // Show in-progress visits that have photos or completed stages (real-time monitoring)
                    if (v.toolPhotoBefore || v.toolPhotoAfter) return true
                    if (v.completedStages && v.completedStages.length > 0) return true
                    if (v.photos && v.photos.length > 0) return true
                    return false
                  }).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
                  if (visits.length === 0) return null
                  return (
                    <div className="mt-4 pt-4 border-t border-border space-y-5">
                      {visits.map(visit => {
                        const isFinal = visit.siteType === 'Final Review'
                        return (
                          <div key={visit.id} className="bg-panel-raised border border-border rounded-lg p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-teal flex items-center gap-1.5 mb-3">
                              {isFinal ? <CheckCircle2 size={14} /> : <Camera size={14} />} 
                              {isFinal ? 'Final Review & Customer Feedback' : 'Installation Evidence'}
                            </div>
                            
                            {isFinal && visit.notes && (
                              <div className="text-sm font-medium text-text whitespace-pre-wrap mb-3 italic bg-white/50 p-2 rounded border border-border">
                                "{visit.notes.replace('Customer Feedback: ', '')}"
                              </div>
                            )}

                            <div className="flex overflow-x-auto pb-2 gap-4 snap-x hide-scrollbar">
                              {/* Photos */}
                              {(visit.toolPhotoBefore || visit.toolPhotoAfter) && (
                                <div className="space-y-1.5 shrink-0 snap-start">
                                  <div className="text-[10px] uppercase text-text-dim font-bold flex items-center gap-1">
                                    <Wrench size={10} /> {isFinal ? 'Site Photos' : 'Tools'}
                                  </div>
                                  <div className="flex gap-2">
                                    {visit.toolPhotoBefore && <EvidenceItem src={visit.toolPhotoBefore} label={isFinal ? "Site Photo 1" : "Tools Before Work"} />}
                                    {visit.toolPhotoAfter && <EvidenceItem src={visit.toolPhotoAfter} label={isFinal ? "Site Photo 2" : "Tools After Work"} />}
                                  </div>
                                </div>
                              )}

                              {/* Stages */}
                              {visit.completedStages?.map(stage => {
                                const stagePhotos = visit.photos?.filter((ph: any) => ph.stage === stage) || []
                                if (stagePhotos.length === 0) return null
                                return (
                                  <div key={stage} className="space-y-1.5 shrink-0 snap-start">
                                    <div className="text-[10px] uppercase text-text-dim font-bold whitespace-nowrap">{stage}</div>
                                    <div className="flex gap-2">
                                      {stagePhotos.map((ph: any) => (
                                        <EvidenceItem key={ph.id} src={ph.filePath} label={stage} />
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <div className="text-[11px] text-text-dim mt-2 border-t border-border pt-2">
                              {visit.submittedAt ? (
                                <>Submitted by <span className="font-medium text-text">{visit.employeeName}</span> on {formatDate(visit.submittedAt)}</>
                              ) : (
                                <><span className="font-medium text-sun">In Progress</span> — <span className="font-medium text-text">{visit.employeeName}</span></>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </Card>
            )
          })}
          <div className="drop-shadow-xs">
            <Pagination currentPage={currentPage} totalItems={monitored.length} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      <Card className="p-3 text-[11px] text-text-dim">
        Document completion and customer review are recorded by the Document Follow-up and Field Technician portals (later phases). This view reads their status flags — no manual override is available here, matching the approved workflow.
      </Card>
    </div>
  )
}
