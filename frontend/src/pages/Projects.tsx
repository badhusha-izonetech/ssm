import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../store/AppStore'
import type { Project } from '../types/models'
import { Card, SectionHeading, Pill, PriorityDot } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import { StageArc } from '../components/shared/StageArc'
import { formatINR, formatDate } from '../lib/utils'
import { X, MapPin, Phone, Wallet } from 'lucide-react'
import { PaymentSubmissionModal } from '../components/partner/PaymentSubmissionModal'

const STATUS_OPTIONS = ['All Status', 'On Track', 'Delayed', 'On Hold', 'Completed', 'Issue Raised']

export default function Projects() {
  const { projects } = useApp()
  const [status, setStatus] = useState('All Status')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (status === 'All Status' || p.status === status) &&
          (p.customerName.toLowerCase().includes(query.toLowerCase()) ||
            p.projectCode.toLowerCase().includes(query.toLowerCase()) ||
            p.area.toLowerCase().includes(query.toLowerCase())),
      ),
    [status, query, projects],
  )
  const paginatedList = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  const columns: Column<Project>[] = [
    {
      header: 'Project', cell: (p) => (
        <div>
          <div className="font-medium text-text">{p.customerName}</div>
          <div className="text-text-dim text-xs">{p.projectCode}</div>
        </div>
      )
    },
    { header: 'Site', cell: (p) => <span className="text-text-dim">{p.site}</span> },
    { header: 'Capacity', cell: (p) => `${p.capacityKw} kW` },
    { header: 'Value', cell: (p) => formatINR(p.projectValue) },
    { header: 'Balance', cell: (p) => <span className={p.balanceAmount > 0 ? 'text-sun' : 'text-teal'}>{formatINR(p.balanceAmount)}</span> },
    { header: 'Stage', cell: (p) => <StageArc stage={p.currentStage} size="sm" /> },
    { header: 'Priority', cell: (p) => <PriorityDot priority={p.priority} /> },
    { header: 'Status', cell: (p) => <Pill status={p.status} /> },
    { header: 'Due', cell: (p) => <span className="text-text-dim">{formatDate(p.dueDate)}</span> },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Project"
        title="All Projects"
        action={<span className="text-xs text-text-dim">{filtered.length} of {projects.length} projects</span>}
      />

      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer, project code, or area…"
          className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 flex-1 min-w-[220px] placeholder:text-slate-400"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Card>

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedList}
          keyFn={(p) => p.id}
          onRowClick={(p) => setSelected(p)}
          mobileCard={(p) => (
            <Card className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{p.customerName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.projectCode} · {p.area}</div>
                </div>
                <Pill status={p.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium py-1">
                <span className="font-bold text-slate-900">{formatINR(p.projectValue)}</span>
                <span>Due {formatDate(p.dueDate)}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-center">
                <StageArc stage={p.currentStage} size="sm" />
              </div>
            </Card>
          )}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {selected && <ProjectDrawer project={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ProjectDrawer({ project, onClose }: { project: Project; onClose: () => void }) {
  const { employees, portal } = useAuth()
  const [showSubmitPayment, setShowSubmitPayment] = useState(false)
  const tech = employees.find((e) => e.id === project.assignedTechnicianId)
  const doc = employees.find((e) => e.id === project.assignedDocEmployeeId)

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border-l border-[#e2e8e5] h-full overflow-y-auto p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold">{project.projectCode}</div>
            <h3 className="text-xl font-display font-bold text-slate-900 mt-0.5">{project.customerName}</h3>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1.5 font-medium"><MapPin size={13} className="text-emerald-600" /> {project.site}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium"><Phone size={13} className="text-emerald-600" /> {project.customerMobile}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex justify-center py-4 bg-slate-50/80 rounded-2xl border border-[#e2e8e5]">
          <StageArc stage={project.currentStage} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Project Value" value={formatINR(project.projectValue)} />
          <Info label="Advance Received" value={formatINR(project.advanceReceived)} />
          <Info label="Balance Due" value={formatINR(project.balanceAmount)} />
          <Info label="Capacity" value={`${project.capacityKw} kW`} />
          <Info label="Warehouse" value={project.warehouseStatus} />
          <Info label="EB Status" value={project.ebStatus} />
          <Info label="Installation" value={project.installationStatus} />
          <Info label="Due Date" value={formatDate(project.dueDate)} />
        </div>

        <div className="space-y-2 p-4 bg-slate-50/80 rounded-2xl border border-[#e2e8e5]">
          <div className="text-[11px] uppercase tracking-wider text-slate-600 font-bold">Assigned Team</div>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-500 font-medium">Field Technician</span><span className="font-semibold text-slate-900">{tech?.name ?? 'Not assigned'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500 font-medium">Document Follow-up</span><span className="font-semibold text-slate-900">{doc?.name ?? 'Not assigned'}</span></div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#e2e8e5] text-[11px] text-slate-500 flex items-center justify-end">
          {['Partner', 'Accountant'].includes(portal as string) && (
            <button onClick={() => setShowSubmitPayment(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors shadow-xs">
              <Wallet size={14} /> Submit Payment
            </button>
          )}
        </div>
      </div>
      {showSubmitPayment && <PaymentSubmissionModal initialProjectId={project.id} onClose={() => setShowSubmitPayment(false)} />}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50/80 border border-[#e2e8e5] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</div>
      <div className="font-bold text-slate-900">{value}</div>
    </div>
  )
}
