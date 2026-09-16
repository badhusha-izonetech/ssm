import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { MapPin, Navigation, Clock } from 'lucide-react'

export default function TransportMovement() {
  const { fieldMovements, deliveries } = useApp()
  const { employee } = useAuth()

  const mine = fieldMovements.filter((f) => f.employeeId === employee?.id).slice().reverse()

  function deliveryFor(fieldMovementId: string) {
    return deliveries.find((d) => d.fieldMovementId === fieldMovementId)
  }

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Transport" title="My Field Movement" action={<span className="text-xs text-text-dim">Simulated live location — frontend demo only</span>} />

      {mine.length === 0 ? (
        <EmptyState title="No trips yet" message="Start a trip from Assigned Deliveries to begin GPS tracking." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {mine.map((f) => {
            const delivery = deliveryFor(f.id)
            return (
              <Card key={f.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{delivery ? `${delivery.projectCode} — ${delivery.customerName}` : f.role}</div>
                    <div className="text-xs text-text-dim">{delivery?.materialSummary ?? f.role}</div>
                  </div>
                  <Pill status={f.status} />
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-sun shrink-0" />
                  <span>{f.currentLocation}</span>
                  <span className="relative flex h-2 w-2 ml-auto">
                    {(f.status === 'On Field' || f.status === 'Returning') && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-60" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${f.status === 'Checked Out' ? 'bg-text-dim' : 'bg-teal'}`} />
                  </span>
                </div>

                {f.destination && (
                  <div className="flex items-center gap-2 text-xs text-text-dim">
                    <Navigation size={13} className="shrink-0" /> Heading to {f.destination}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-text-dim">
                  <Clock size={13} className="shrink-0" /> Started {f.startTime} · Last update {f.lastUpdate}
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="text-[10px] uppercase tracking-wide text-text-dim font-medium mb-2">Route History</div>
                  <div className="space-y-1.5">
                    {f.routeHistory.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-sun shrink-0" />
                        <span className="text-text-dim w-16 shrink-0">{r.time}</span>
                        <span className="truncate">{r.location}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-text-dim">CEO can view this same simulated live state and route history from the Field Movement dashboard. Backend integration point: <code className="text-teal">GET /transport/{'{driverId}'}/movement</code>.</p>
    </div>
  )
}
