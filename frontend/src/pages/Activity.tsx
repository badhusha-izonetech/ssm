import { useState, useEffect } from 'react'
import { Card, SectionHeading } from '../components/shared/Primitives'
import { activityApi } from '../api/activity'
import type { ActivityLog } from '../types/models'
import { format } from 'date-fns'

export default function Activity() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    activityApi.getActivityLogs({ limit: 50 }).then((res) => {
      if (res && res.items) {
        setActivityLogs(res.items)
      }
    }).catch(console.error)
    .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Governance" title="Activity / Audit History" action={<span className="text-xs text-text-dim">System Audit Trail</span>} />
      <Card className="p-5">
        <div className="relative pl-6">
          <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-emerald-100" />
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-sm text-text-dim py-4">Loading audit trail...</div>
            ) : activityLogs.length === 0 ? (
              <div className="text-sm text-text-dim py-4">No activity history available.</div>
            ) : (
              activityLogs.map((a) => (
                <div key={a.id} className="relative group">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-emerald-50 border-2 border-emerald-600 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </div>
                  <div className="bg-panel-raised/50 border border-border/80 rounded-xl p-3.5 hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-text">{a.actor}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-medium">
                        {a.department}
                      </span>
                      <span className="text-[11px] text-text-dim ml-auto">
                        {a.timestamp ? format(new Date(a.timestamp), 'PP pp') : ''}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-text mt-0.5">{a.action}</div>
                    <div className="text-xs font-medium text-emerald-700 mt-0.5">{a.entity}</div>
                    {a.detail && <div className="text-xs text-text-dim mt-1 bg-panel/70 p-2 rounded-lg border border-border/60">{a.detail}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
