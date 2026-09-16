import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { Pagination } from '../../components/shared/Pagination'
import { EbApplicationDetail } from '../../components/documents/EbApplicationDetail'
import { Search, FileText } from 'lucide-react'
import type { EbApplication, EbDashboardCounters } from '../../types/models'
import { ebApplicationsApi } from '../../api/ebApplications'

const TABS: { key: string; label: string; match: (a: EbApplication) => boolean }[] = [
  { key: 'received', label: 'Docs Collection', match: (a) => a.currentStage === 'Application Received' || a.currentStage === 'Document Collection' },
  { key: 'verification', label: 'Verification', match: (a) => a.currentStage === 'Document Verification' },
  { key: 'portal', label: 'Portal & EB', match: (a) => a.currentStage === 'EB/TANGEDCO Portal Submission' || a.currentStage === 'EB Process / Awaiting Further Action' },
  { key: 'handover', label: 'Handover', match: (a) => a.currentStage === 'Handover Application with EB Meter Supply' },
]

export default function EbApplications() {
  const { ebApplications } = useApp()
  const [tab, setTab] = useState('received')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  const [counters, setCounters] = useState<EbDashboardCounters | null>(null)

  useEffect(() => {
    ebApplicationsApi.getDashboardCounters().then(setCounters).catch(console.error)
  }, [ebApplications])

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.key === tab)!
    return ebApplications
      .filter((a) => activeTab.match(a))
      .filter((a) => !search.trim() || a.customerName.toLowerCase().includes(search.toLowerCase()) || a.projectCode.toLowerCase().includes(search.toLowerCase()))
  }, [ebApplications, tab, search])

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])
  
  useEffect(() => {
    setCurrentPage(1)
  }, [search, tab])

  const selected = selectedId ? ebApplications.find((a) => a.id === selectedId) ?? null : null

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Document Follow-up" title="EB Applications" />

      {counters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 bg-panel-raised border-border">
            <div className="text-[10px] uppercase text-text-dim">Received / Pending Docs</div>
            <div className="text-xl font-semibold text-sun mt-1">{counters.application_received} / {counters.documents_pending}</div>
          </Card>
          <Card className="p-3 bg-panel-raised border-border">
            <div className="text-[10px] uppercase text-text-dim">Docs Verified / Not Verified</div>
            <div className="text-xl font-semibold text-teal mt-1">{counters.documents_verified} / <span className="text-rose">{counters.documents_not_verified}</span></div>
          </Card>
          <Card className="p-3 bg-panel-raised border-border">
            <div className="text-[10px] uppercase text-text-dim">Portal Pending / Submitted</div>
            <div className="text-xl font-semibold text-sun mt-1">{counters.portal_submission_pending} / {counters.portal_submitted}</div>
          </Card>
          <Card className="p-3 bg-panel-raised border-border">
            <div className="text-[10px] uppercase text-text-dim">Handover Pending / Completed</div>
            <div className="text-xl font-semibold text-teal mt-1">{counters.handover_pending} / {counters.completed}</div>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-2 bg-panel-raised border border-border rounded-lg px-3 py-2 max-w-sm">
        <Search size={14} className="text-text-dim shrink-0" />
        <input className="bg-transparent outline-none text-xs w-full placeholder:text-text-dim" placeholder="Search customer or project…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = ebApplications.filter((a) => t.match(a)).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tab === t.key ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}
            >
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here" message="There are no EB applications in this category right now." />
      ) : (
        <div className="flex flex-col gap-2">
          {paginatedFiltered.map((a) => {
            return (
              <Card key={a.id} className="p-4 cursor-pointer hover:border-sun/40 transition-colors" onClick={() => setSelectedId(a.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sun/10 flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-sun" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-text truncate">{a.projectCode} — {a.customerName}</div>
                      <div className="text-xs text-text-dim mt-0.5">
                        {a.projectDetails || 'No details'}
                      </div>
                      <div className="text-xs text-text-dim mt-0.5">
                        Assigned on {formatDate(a.assignedAt)}
                      </div>
                    </div>
                  </div>
                  <Pill status={a.currentStage} />
                </div>
              </Card>
            )
          })}
          <div className="drop-shadow-xs">
            <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      {selected && <EbApplicationDetail application={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
