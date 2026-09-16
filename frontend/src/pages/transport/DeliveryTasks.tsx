import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Pill, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { DeliveryDetail } from '../../components/transport/DeliveryDetail'
import { MapPin, Search, Truck } from 'lucide-react'
import type { Delivery } from '../../types/models'

const TABS: { key: string; label: string; match: (d: Delivery) => boolean }[] = [
  { key: 'active', label: 'Active', match: (d) => d.status === 'Trip Started' || d.status === 'On Route' || d.status === 'Arrived' || d.status === 'Returning' },
  { key: 'assigned', label: 'Assigned', match: (d) => d.status === 'Assigned' },
  { key: 'delivered', label: 'Delivered', match: (d) => d.status === 'Delivered' },
  { key: 'completed', label: 'Completed', match: (d) => d.status === 'Completed' },
]

export default function DeliveryTasks() {
  const { deliveries } = useApp()
  const { employee } = useAuth()
  const [tab, setTab] = useState('active')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mine = useMemo(() => deliveries.filter((d) => d.assignedDriverId === employee?.id), [deliveries, employee])

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.key === tab)!
    return mine
      .filter((d) => activeTab.match(d))
      .filter((d) => !search.trim() || d.customerName.toLowerCase().includes(search.toLowerCase()) || d.projectCode.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
  }, [mine, tab, search])

  const selected = selectedId ? deliveries.find((d) => d.id === selectedId) ?? null : null

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Transport" title="Assigned Deliveries" />

      <div className="flex items-center gap-2 bg-panel-raised border border-border rounded-lg px-3 py-2 max-w-sm">
        <Search size={14} className="text-text-dim shrink-0" />
        <input className="bg-transparent outline-none text-xs w-full placeholder:text-text-dim" placeholder="Search customer or project…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = mine.filter((d) => t.match(d)).length
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
        <EmptyState title="No deliveries here" message="There are no delivery tasks in this category right now." />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <Card key={d.id} className="p-4 cursor-pointer hover:border-sun/40 transition-colors" onClick={() => setSelectedId(d.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sun/10 flex items-center justify-center shrink-0">
                    <Truck size={15} className="text-sun" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-text truncate">{d.projectCode} — {d.customerName}</div>
                    <div className="text-xs text-text-dim truncate">{d.materialSummary}</div>
                    <div className="text-xs text-text-dim flex items-center gap-1 mt-0.5"><MapPin size={11} />{d.pickup} → {d.destination}</div>
                    <div className="text-xs text-text-dim mt-0.5">{formatDate(d.scheduledDate)}</div>
                  </div>
                </div>
                <Pill status={d.status} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && <DeliveryDetail delivery={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
