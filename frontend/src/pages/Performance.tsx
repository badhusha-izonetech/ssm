import { useMemo, useState } from 'react'
import { performanceRecords } from '../data/mockData'
import { useAuth } from '../auth/AuthContext'
import { Card, SectionHeading, KpiCard, EmptyState } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import type { PerformanceRecord } from '../types/models'
import { Trophy } from 'lucide-react'

export default function Performance() {
  const { employee, portal } = useAuth()
  const isManagement = portal === 'CEO' || portal === 'Project Head'
  const isCeo = portal === 'CEO'
  const [tab, setTab] = useState<'mine' | 'leaderboard'>(isCeo ? 'leaderboard' : 'mine')
  const [department, setDepartment] = useState<string>(isManagement ? 'All Departments' : employee?.department ?? 'All Departments')

  const departments = useMemo(
    () => ['All Departments', ...Array.from(new Set(performanceRecords.map((p) => p.department)))],
    [],
  )

  const myRecords = useMemo(
    () => performanceRecords.filter((p) => p.employeeId === employee?.id).slice().sort((a, b) => (a.period < b.period ? 1 : -1)),
    [employee],
  )
  const latest = myRecords[0]

  const leaderboardRows = useMemo(() => {
    const rows = performanceRecords.filter((p) => department === 'All Departments' || p.department === department)
    // Keep only the latest period per employee for a clean leaderboard
    const byEmployee = new Map<string, PerformanceRecord>()
    for (const r of rows) {
      const existing = byEmployee.get(r.employeeId)
      if (!existing || existing.period < r.period) byEmployee.set(r.employeeId, r)
    }
    return Array.from(byEmployee.values()).sort((a, b) => b.score - a.score)
  }, [department])

  const columns: Column<PerformanceRecord>[] = [
    { header: 'Rank', cell: (p) => (
      <span className="flex items-center gap-1 font-medium">
        {leaderboardRows[0]?.id === p.id && <Trophy size={13} className="text-sun" />}
        #{leaderboardRows.findIndex((r) => r.id === p.id) + 1}
      </span>
    ) },
    { header: 'Employee', cell: (p) => (
      <div>
        <div className="font-medium">{p.employeeName}</div>
        <div className="text-xs text-text-dim">{p.role}</div>
      </div>
    ) },
    { header: 'Department', cell: (p) => p.department },
    { header: 'Period', cell: (p) => <span className="text-text-dim">{p.period}</span> },
    { header: 'Score', cell: (p) => (
      <div className="flex items-center gap-2 w-28">
        <div className="flex-1 h-1.5 bg-black/[0.035] rounded-full overflow-hidden">
          <div className="h-full bg-sun rounded-full" style={{ width: `${p.score}%` }} />
        </div>
        <span className="text-xs w-8">{p.score}</span>
      </div>
    ) },
    { header: 'Completed', cell: (p) => p.completedWork },
    { header: 'Pending', cell: (p) => <span className="text-text-dim">{p.pendingWork}</span> },
    { header: 'Efficiency', cell: (p) => `${p.efficiency}%` },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Common Module" title="Performance" action={<span className="text-xs text-text-dim">Ranking formula finalization pending</span>} />

      <div className="flex rounded-xl p-1 bg-panel-raised border border-border w-fit shadow-xs">
        {!isCeo && (
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'mine' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'
            }`}
          >
            My Performance
          </button>
        )}
        <button
          onClick={() => setTab('leaderboard')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'leaderboard' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'
          }`}
        >
          Leaderboard
        </button>
      </div>

      {!isCeo && tab === 'mine' && (
        <div className="space-y-5">
          {!latest ? (
            <EmptyState title="No performance data yet" message="Performance records for your role will appear here once metrics are captured for a period." />
          ) : (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                <KpiCard label="Latest Score" value={String(latest.score)} sub={`Rank #${latest.rank} · ${latest.period}`} accent="sun" />
                <KpiCard label="Completed Work" value={String(latest.completedWork)} sub={`${latest.efficiency}% efficiency`} accent="teal" />
                <KpiCard label="Pending Work" value={String(latest.pendingWork)} accent="rose" />
              </div>

              <Card className="p-5 space-y-4">
                <div className="text-xs uppercase tracking-wider text-text-dim font-semibold">Period History</div>
                <div className="space-y-3">
                  {myRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-2.5 border-b border-border/70 last:border-0">
                      <div>
                        <div className="font-semibold text-text">{r.period}</div>
                        <div className="text-text-dim mt-0.5">Rank #{r.rank} · {r.completedWork} completed · {r.pendingWork} pending</div>
                      </div>
                      <div className="flex items-center gap-2.5 w-32">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${r.score}%` }} />
                        </div>
                        <span className="w-9 font-semibold text-text text-right">{r.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="space-y-4">
          {isManagement && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-dim font-medium">Filter by Department:</span>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-xl bg-panel border border-border shadow-xs outline-none focus:border-emerald-500 transition"
              >
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <Card className="p-1">
            <DataTable
              columns={columns}
              rows={leaderboardRows}
              keyFn={(p) => p.id}
              mobileCard={(p) => (
                <Card className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold text-text flex items-center gap-1.5">
                      {leaderboardRows[0]?.id === p.id && <Trophy size={14} className="text-amber-500" />} {p.employeeName}
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">Score {p.score}</span>
                  </div>
                  <div className="text-xs text-text-dim">{p.role} · {p.department} · {p.period}</div>
                </Card>
              )}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
