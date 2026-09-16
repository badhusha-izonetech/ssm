import { departmentList } from '../data/mockData'
import { useAuth } from '../auth/AuthContext'
import { Card, SectionHeading, Avatar } from '../components/shared/Primitives'

export default function Departments() {
  const { employees } = useAuth()
  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Structure" title="Departments" action={<span className="text-xs text-text-dim">{departmentList.length} Operating Divisions</span>} />
      <div className="grid md:grid-cols-2 gap-5">
        {departmentList.map((d) => {
          const staff = employees.filter((e) => e.department === d.name)
          return (
            <Card key={d.name} className="p-5 flex flex-col justify-between hover:border-emerald-200 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-text">{d.name}</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-medium">
                    {staff.length} staff
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {d.teams.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5 pt-3 border-t border-border/70">
                <div className="text-[11px] font-medium uppercase tracking-wider text-text-dim">Assigned Staff</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {staff.map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-panel-raised/60 border border-border/50">
                      <Avatar name={e.name} color={e.avatarColor} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text truncate">{e.name}</div>
                        <div className="text-[11px] text-text-dim truncate">{e.designation}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {staff.length === 0 && <div className="text-xs text-text-dim py-2">No employees assigned yet.</div>}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
