import { useState } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { EbApplicationDetail } from '../../components/documents/EbApplicationDetail'
import { CalendarClock } from 'lucide-react'

export default function FollowUpCalendar() {
  const { ebApplications } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const withFollowUp = ebApplications
    .filter((a) => a.followUpDate)
    .slice()
    .sort((a, b) => (a.followUpDate ?? '').localeCompare(b.followUpDate ?? ''))

  const selected = selectedId ? ebApplications.find((a) => a.id === selectedId) ?? null : null

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Document Follow-up" title="Follow-up Calendar" />

      {withFollowUp.length === 0 ? (
        <EmptyState title="Nothing scheduled" message="No EB applications have a follow-up date set." />
      ) : (
        <div className="space-y-2">
          {withFollowUp.map((a) => (
            <Card key={a.id} className="p-4 cursor-pointer hover:border-sun/40 transition-colors" onClick={() => setSelectedId(a.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sun/10 flex items-center justify-center shrink-0">
                    <CalendarClock size={15} className="text-sun" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-text truncate">{a.projectCode} — {a.customerName}</div>
                    <div className="text-xs text-text-dim mt-0.5">Follow-up on {formatDate(a.followUpDate ?? '')}</div>
                    {a.contactedPerson && <div className="text-xs text-text-dim">Contact: {a.contactedPerson}</div>}
                  </div>
                </div>
                <Pill status={a.ebStatus || ''} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && <EbApplicationDetail application={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
