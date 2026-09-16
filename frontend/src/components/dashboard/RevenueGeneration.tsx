import { useEffect, useState, useMemo, useCallback } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, RefreshCw } from 'lucide-react'
import { Card, KpiCard, Pill, SectionHeading } from '../shared/Primitives'
import { DataTable, type Column } from '../shared/DataTable'
import { Pagination } from '../shared/Pagination'
import { formatDate, formatINR } from '../../lib/utils'
import { rangeFor } from '../../lib/revenue'
import { revenueApi, type RevenueProject, type RevenueData, type EmployeeRevenueSummaryItem, type EmployeeRevenueDetail } from '../../api/revenue'
import { openRevenueReport } from '../../lib/revenueDoc'

const FILTERS = ['Today', 'Yesterday', 'This Week', 'This Month', 'This Year', 'Custom Date Range']

export function RevenueGeneration() {
  const [filter, setFilter] = useState('This Month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<RevenueData | null>(null)
  const [employeeSummary, setEmployeeSummary] = useState<EmployeeRevenueSummaryItem[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeRevenueDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectPage, setProjectPage] = useState(1)

  const range = useMemo(() => rangeFor(filter, customFrom, customTo), [filter, customFrom, customTo])

  const fetchRevenue = useCallback(async () => {
    if (filter === 'Custom Date Range' && (!customFrom || !customTo)) return
    setLoading(true)
    setError(null)
    try {
      const result = await revenueApi.getSummary(range.from || undefined, range.to || undefined)
      const empSummary = await revenueApi.getEmployeeSummary(range.from || undefined, range.to || undefined)
      setData(result)
      setEmployeeSummary(empSummary)
      setProjectPage(1)
      if (selectedEmployeeId) {
        const details = await revenueApi.getEmployeeDetails(selectedEmployeeId, range.from || undefined, range.to || undefined)
        setEmployeeDetails(details)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load revenue data')
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to, filter, customFrom, customTo])

  useEffect(() => {
    fetchRevenue()
  }, [fetchRevenue])

  useEffect(() => {
    if (selectedEmployeeId) {
      revenueApi.getEmployeeDetails(selectedEmployeeId, range.from || undefined, range.to || undefined)
        .then(setEmployeeDetails)
        .catch(console.error)
    }
  }, [selectedEmployeeId, range.from, range.to])

  const summary = data?.summary
  const projects = data?.projects ?? []
  const allProjects = data?.allProjects ?? []
  const paginatedProjects = useMemo(() => projects.slice((projectPage - 1) * 25, projectPage * 25), [projects, projectPage])

  // KPI cards for absolute periods (always show full scope regardless of filter)
  const [kpiData, setKpiData] = useState<{ today: number; week: number; month: number; year: number } | null>(null)
  useEffect(() => {
    const today = rangeFor('Today', '', '')
    const week = rangeFor('This Week', '', '')
    const month = rangeFor('This Month', '', '')
    const year = rangeFor('This Year', '', '')
    Promise.all([
      revenueApi.getSummary(today.from, today.to),
      revenueApi.getSummary(week.from, week.to),
      revenueApi.getSummary(month.from, month.to),
      revenueApi.getSummary(year.from, year.to),
    ]).then(([t, w, m, y]) => {
      setKpiData({
        today: t.summary.totalRevenue,
        week: w.summary.totalRevenue,
        month: m.summary.totalRevenue,
        year: y.summary.totalRevenue,
      })
    }).catch(() => {})
  }, [])

  const chartData = useMemo(
    () => (data?.daily ?? []).map((d) => ({ date: formatDate(d.date), revenue: d.revenue })),
    [data],
  )

  const columns: Column<RevenueProject>[] = [
    {
      header: 'Project / Customer',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.projectCode}</div>
          <div className="text-xs text-text-dim">{row.customerName}</div>
        </div>
      ),
    },
    { header: 'Fully Paid Date', cell: (row) => formatDate(row.fullyPaidDate ?? '') },
    { header: 'Total Amount', cell: (row) => formatINR(row.projectValue) },
    { header: 'Amount Received', cell: (row) => formatINR(row.amountReceived) },
    { header: 'Verified Amount', cell: (row) => formatINR(row.verifiedAmount) },
    { header: 'Pending', cell: (row) => formatINR(row.pendingAmount) },
    { header: 'Verified %', cell: (row) => `${row.verifiedPct.toFixed(0)}%` },
    { header: 'Revenue', cell: (row) => formatINR(row.revenue) },
    { header: 'Status', cell: (row) => <Pill status={row.paymentStatus} /> },
    { header: 'Verifier', cell: (row) => row.finalVerifier ?? '—' },
  ]

  const label =
    filter === 'Custom Date Range'
      ? range.from && range.to
        ? `${formatDate(range.from)} – ${formatDate(range.to)}`
        : 'Custom range'
      : range.label

  return (
    <section className="space-y-4 pt-2">
      <SectionHeading
        eyebrow="CEO → Finance"
        title="Revenue Generation"
        action={
          <button
            onClick={() =>
              openRevenueReport(
                projects,
                allProjects,
                label,
                {
                  overall: summary?.totalRevenue ?? 0,
                  totalCollections: summary?.totalCollections ?? 0,
                  pendingReceivables: summary?.pendingReceivables ?? 0,
                  fullyPaidProjects: summary?.fullyPaidProjects ?? 0,
                  partiallyPaidProjects: summary?.partiallyPaidProjects ?? 0,
                },
                new Date().toLocaleString('en-IN'),
              )
            }
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 hover:bg-emerald-700 shadow-xs transition"
          >
            <Download size={15} /> Download Revenue Report PDF
          </button>
        }
      />

      {/* Period selector */}
      <Card className="p-3.5 flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-dim font-medium">Revenue recognition period:</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-panel-raised border border-border rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 shadow-xs transition"
        >
          {FILTERS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        {filter === 'Custom Date Range' && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-panel-raised border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500 shadow-xs transition"
            />
            <span className="text-xs text-text-dim">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-panel-raised border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500 shadow-xs transition"
            />
          </>
        )}
        <span className="ml-auto text-xs text-text-dim flex items-center gap-1.5 font-medium">
          {loading && <RefreshCw size={12} className="animate-spin text-emerald-600" />}
          {label}
        </span>
      </Card>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          label="Overall Revenue"
          value={loading ? '…' : formatINR(summary?.totalRevenue ?? 0)}
          sub="For selected period"
          accent="teal"
        />
        <KpiCard label="Revenue Today" value={kpiData ? formatINR(kpiData.today) : '…'} accent="teal" />
        <KpiCard label="Revenue This Week" value={kpiData ? formatINR(kpiData.week) : '…'} accent="teal" />
        <KpiCard label="Revenue This Month" value={kpiData ? formatINR(kpiData.month) : '…'} accent="teal" />
        <KpiCard label="Revenue This Year" value={kpiData ? formatINR(kpiData.year) : '…'} accent="teal" />
        <KpiCard
          label="Pending Receivables"
          value={loading ? '…' : formatINR(summary?.pendingReceivables ?? 0)}
          sub="All incomplete projects"
          accent="sun"
        />
        <KpiCard
          label="Fully Paid Projects"
          value={loading ? '…' : String(summary?.fullyPaidProjects ?? 0)}
          sub="In selected period"
          accent="teal"
        />
        <KpiCard
          label="Partially Paid"
          value={loading ? '…' : String(summary?.partiallyPaidProjects ?? 0)}
          sub="Awaiting balance"
          accent="sun"
        />
      </div>

      {/* Bar Chart */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-3">
          <SectionHeading eyebrow="Trend" title="Date-wise revenue generation" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e5" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(v) => `₹${Number(v) / 1000}k`}
              />
              <Tooltip
                formatter={(v) => formatINR(Number(v))}
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8e5',
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }}
              />
              <Bar dataKey="revenue" name="Revenue generated" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {!loading && !chartData.length && (
            <p className="text-center text-xs text-text-dim -mt-28 pb-20">
              No 100% accountant-verified revenue in this period.
            </p>
          )}
        </Card>
      </div>

      {/* Project-wise Table */}
      <Card className="p-4">
        <SectionHeading eyebrow="Breakdown" title="Project-wise revenue" />
        <div className="flex flex-col drop-shadow-xs mt-3">
          <DataTable
            columns={columns}
            rows={paginatedProjects}
            keyFn={(row) => row.projectId}
            mobileCard={(row) => (
              <Card className="p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{row.projectCode}</span>
                  <Pill status={row.paymentStatus} />
                </div>
                <div className="text-xs text-text-dim">
                  {row.fullyPaidDate ? formatDate(row.fullyPaidDate) : '—'} · {row.verifiedPct.toFixed(0)}% verified
                </div>
                <div className="text-sm">{formatINR(row.projectValue)}</div>
              </Card>
            )}
          />
          <Pagination
            currentPage={projectPage}
            totalItems={projects.length}
            onPageChange={setProjectPage}
          />
        </div>
        {!loading && projects.length === 0 && (
          <p className="text-center text-xs text-text-dim py-8">
            No fully paid projects in this period.
          </p>
        )}
      </Card>

      {/* Employee Revenue Table */}
      <Card className="p-4">
        <SectionHeading eyebrow="Attribution" title="Employee Revenue" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-sm font-semibold mb-3">Employee List</div>
            <div className="space-y-2">
              {employeeSummary.map((emp) => (
                <div 
                  key={emp.employeeId} 
                  className={`flex justify-between items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedEmployeeId === emp.employeeId ? 'border-sun bg-sun/10' : 'border-border hover:border-sun/50'}`}
                  onClick={() => setSelectedEmployeeId(emp.employeeId)}
                >
                  <div>
                    <div className="font-medium text-text">{emp.employeeName}</div>
                    <div className="text-xs text-text-dim">{emp.department} — {emp.designation}</div>
                  </div>
                  <div className="font-semibold text-sun">{formatINR(emp.totalRevenue)}</div>
                </div>
              ))}
              {!loading && employeeSummary.length === 0 && (
                <p className="text-center text-xs text-text-dim py-8">No employee revenue in this period.</p>
              )}
            </div>
          </div>
          <div className="flex flex-col h-full">
            <div className="text-sm font-semibold mb-3">Employee Details</div>
            {employeeDetails ? (
              <Card className="p-4 bg-panel">
                <div className="mb-4 pb-4 border-b border-border">
                  <div className="text-lg font-semibold">{employeeDetails.employeeName}</div>
                  <div className="text-sm text-text-dim">{employeeDetails.department} — {employeeDetails.designation}</div>
                  <div className="mt-2 text-xl font-bold text-teal">{formatINR(employeeDetails.totalRevenue)}</div>
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-dim">Projects</div>
                  {employeeDetails.projects.map(p => (
                    <div key={p.invoiceId} className="flex justify-between items-start text-sm">
                      <div>
                        <div className="font-medium">{p.projectName}</div>
                        <div className="text-xs text-text-dim">Inv: {p.invoiceNumber} · {formatDate(p.invoiceDate)}</div>
                      </div>
                      <div className="font-medium">{formatINR(p.revenue)}</div>
                    </div>
                  ))}
                  {employeeDetails.projects.length === 0 && (
                    <div className="text-xs text-text-dim py-4 text-center">No projects in this period.</div>
                  )}
                </div>
              </Card>
            ) : (
              <div className="flex-1 min-h-[200px] flex items-center justify-center p-8 border border-dashed border-border rounded-lg text-text-dim text-sm">
                Select an employee to view details
              </div>
            )}
          </div>
        </div>
      </Card>
    </section>
  )
}
