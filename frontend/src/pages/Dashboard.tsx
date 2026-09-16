import { useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  CartesianGrid,
} from 'recharts'
import { useAuth } from '../auth/AuthContext'
import { Card, KpiCard, SectionHeading, Pill } from '../components/shared/Primitives'
import { StageArc } from '../components/shared/StageArc'
import { useApp } from '../store/AppStore'
import { formatINR, formatDate } from '../lib/utils'
import {
  AlertTriangle,
  TrendingUp,
  Filter,
  IndianRupee,
  CreditCard,
  Handshake,
  CheckCircle2,
  Package,
  ShieldCheck,
  Receipt,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { gstApi, type GSTSummary } from '../api/gst'
import { DashboardBanner } from '../components/shared/DashboardBanner'
import columnBoxAsset from '../assets/dashboard_column_box.png'

export default function Dashboard() {
  const { employee } = useAuth()
  const { leads, leaveRequests, projects, payments, stockItems, ceoDashboard } = useApp()
  const navigate = useNavigate()

  // Extract unique areas from the app store projects
  const AREA_OPTIONS = useMemo(() => ['All Areas', ...Array.from(new Set(projects.map((p) => p.area)))], [projects])
  const PRIORITY_OPTIONS = ['All Priorities', 'High', 'Medium', 'Low']
  const STATUS_OPTIONS = ['All Status', 'On Track', 'Delayed', 'On Hold', 'Completed', 'Issue Raised']

  const [area, setArea] = useState('All Areas')
  const [priority, setPriority] = useState('All Priorities')
  const [status, setStatus] = useState('All Status')
  const [gstSummary, setGstSummary] = useState<GSTSummary[]>([])

  useEffect(() => {
    gstApi.getSummary().then(setGstSummary).catch(console.error)
  }, [])

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          (area === 'All Areas' || p.area === area) &&
          (priority === 'All Priorities' || p.priority === priority) &&
          (status === 'All Status' || p.status === status),
      ),
    [area, priority, status, projects],
  )

  const totalPipelineValue = ceoDashboard?.totalPipelineValue ?? filteredProjects.reduce((s, p) => s + p.projectValue, 0)
  const outstanding = ceoDashboard?.outstandingBalance ?? filteredProjects.reduce((s, p) => s + p.balanceAmount, 0)
  const activeProjects = ceoDashboard?.activeProjectCount ?? filteredProjects.filter((p) => p.status !== 'Completed').length
  const delayedCount = ceoDashboard?.delayedCount ?? filteredProjects.filter((p) => p.status === 'Delayed' || p.status === 'Issue Raised').length
  const convertedLeads = leads.filter((l) => l.status === 'Converted').length
  const lowStock = stockItems.filter((s) => s.availableQuantity <= s.minimumLevel)
  const lowStockCount = ceoDashboard?.lowStockCount ?? lowStock.length

  // Calculate pending approvals dynamically from leaveRequests (and others in the future)
  const pendingApprovals = ceoDashboard?.pendingApprovalsCount ?? leaveRequests.filter((a) => a.status === 'Pending').length

  const verifiedThisWeek = ceoDashboard?.thisMonthVerifiedPayments ?? payments.filter((p) => p.state === 'Verified').reduce((s, p) => s + p.actualAmount, 0)

  const stageChartData = ceoDashboard?.projectsByStage?.length ? ceoDashboard.projectsByStage : useMemo(() => {
    const counts: Record<string, number> = {}
    filteredProjects.forEach((p) => {
      counts[p.currentStage] = (counts[p.currentStage] ?? 0) + 1
    })
    return Object.entries(counts).map(([stage, count]) => ({ stage, count }))
  }, [filteredProjects])

  const leadSourceData = ceoDashboard?.leadsBySource?.length ? ceoDashboard.leadsBySource : useMemo(() => {
    const counts: Record<string, number> = {}
    leads.forEach((l) => {
      counts[l.leadSource] = (counts[l.leadSource] ?? 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [leads])

  const PIE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#059669', '#38bdf8', '#64748b', '#84cc16']

  // Sum up all yearly GST payable as a quick KPI
  const yearlyGst = gstSummary.find((s) => s.label === String(new Date().getFullYear()))?.gst_payable || 0

  return (
    <div className="space-y-6">
      {/* Executive Hero Banner Card */}
      <DashboardBanner
        portal="CEO"
        title={`Hello, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Executive overview of solar operations, project pipelines, and departmental performance."
      />

      {/* Filters */}
      <div className="bg-white border border-[#e2e8e5] rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider pr-1">
          <Filter size={14} className="text-emerald-600" /> Filters
        </div>
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <select value={area} onChange={(e) => setArea(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
            {AREA_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
            {PRIORITY_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15">
            {STATUS_OPTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 ml-auto">
          {filteredProjects.length} of {projects.length} projects shown
        </span>
      </div>

      {/* KPIs Grid 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<IndianRupee size={22} className="stroke-[2.2]" />} label="Active Pipeline Value" value={formatINR(totalPipelineValue)} sub={`${activeProjects} active projects`} accent="teal" />
        <KpiCard icon={<CreditCard size={22} className="stroke-[2.2]" />} label="Outstanding Balance" value={formatINR(outstanding)} sub="Across filtered projects" accent="rose" />
        <KpiCard icon={<Handshake size={22} className="stroke-[2.2]" />} label="Lead Conversion" value={String(convertedLeads)} sub={`${convertedLeads} of ${leads.length} leads converted`} accent="sun" />
        <KpiCard icon={<CheckCircle2 size={22} className="stroke-[2.2]" />} label="Verified Collections" value={formatINR(verifiedThisWeek)} sub="Verified by accounts this week" accent="teal" />
      </div>

      {/* KPIs Grid 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<AlertTriangle size={22} className="stroke-[2.2]" />} label="Delayed / Issue Projects" value={String(delayedCount)} sub="Needs CEO attention" accent="rose" />
        <KpiCard icon={<Package size={22} className="stroke-[2.2]" />} label="Low Stock Items" value={String(lowStockCount)} sub="Below minimum level" accent="rose" />
        <KpiCard icon={<ShieldCheck size={22} className="stroke-[2.2]" />} label="Pending Approvals" value={String(pendingApprovals)} sub="Awaiting CEO decision" accent="amber" onClick={() => navigate('/approvals')} />
        <KpiCard icon={<Receipt size={22} className="stroke-[2.2]" />} label="YTD GST Payable" value={formatINR(yearlyGst)} sub="Year-to-date GST" accent="sky" onClick={() => navigate('/gst')} />
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <SectionHeading eyebrow="Workflow" title="Projects by current stage" />
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={stageChartData} margin={{ left: -15, right: 10, top: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e5" vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #1e293b', 
                  borderRadius: 12, 
                  fontSize: 12,
                  color: '#ffffff',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }} 
              />
              <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Marketing" title="Leads by source" />
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie data={leadSourceData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {leadSourceData.map((_: any, i: number) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #1e293b', 
                  borderRadius: 12, 
                  fontSize: 12,
                  color: '#ffffff',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Stage Map & Attention Column */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <SectionHeading eyebrow="Live" title="Active project stage map" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProjects.filter((p) => p.status !== 'Completed').map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 hover:border-emerald-300 transition-colors">
                <StageArc stage={p.currentStage} size="sm" />
                <div className="text-center w-full min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate w-full">{p.projectCode}</div>
                  <div className="text-[11px] text-slate-500 font-medium truncate w-full">{p.customerName}</div>
                </div>
                <Pill status={p.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between overflow-hidden">
          <div>
            <SectionHeading eyebrow="Risk" title="Needs your attention" />
            
            {/* Solar Column Box Featured Asset */}
            <div className="relative rounded-xl overflow-hidden mb-4 border border-[#e2e8e5] shadow-xs">
              <img src={columnBoxAsset} alt="Solar Clean Energy" className="w-full h-28 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-3">
                <div className="text-white text-xs font-semibold">Clean Energy Operations · Attention Items</div>
              </div>
            </div>

            <div className="space-y-3">
              {ceoDashboard?.attentionStockItems ? ceoDashboard.attentionStockItems.slice(0, 2).map((s: any) => (
                <div key={s.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                  <AlertTriangle size={15} className="text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-slate-900 font-bold">{s.productName}</div>
                    <div className="text-slate-500 font-medium">{s.availableQuantity} {s.unit} available, minimum {s.minimumLevel}</div>
                  </div>
                </div>
              )) : lowStock.slice(0, 2).map((s: any) => (
                <div key={s.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                  <AlertTriangle size={15} className="text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-slate-900 font-bold">{s.productName}</div>
                    <div className="text-slate-500 font-medium">{s.availableQuantity} {s.unit} available, minimum {s.minimumLevel}</div>
                  </div>
                </div>
              ))}
              {ceoDashboard?.attentionProjects ? ceoDashboard.attentionProjects.slice(0, 2).map((p: any) => (
                <div key={p.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                  <TrendingUp size={15} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-slate-900 font-bold">{p.projectCode} — {p.customerName}</div>
                    <div className="text-slate-600 font-medium">{p.nextAction}</div>
                    <div className="text-slate-400 text-[11px] font-medium mt-0.5">Due {formatDate(p.dueDate)}</div>
                  </div>
                </div>
              )) : filteredProjects.filter((p) => p.status === 'Delayed' || p.status === 'Issue Raised').slice(0, 2).map((p) => (
                <div key={p.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                  <TrendingUp size={15} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-slate-900 font-bold">{p.projectCode} — {p.customerName}</div>
                    <div className="text-slate-600 font-medium">{p.nextAction}</div>
                    <div className="text-slate-400 text-[11px] font-medium mt-0.5">Due {formatDate(p.dueDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
