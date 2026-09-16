import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import type { StockMovementType } from '../../types/models'

const TYPES: ('All' | StockMovementType)[] = ['All', 'Receipt', 'Reservation', 'Issue', 'Return', 'Adjustment', 'Damage', 'Missing', 'Transfer']

const TYPE_TINT: Record<string, string> = {
  Receipt: 'text-teal bg-teal/10 border-teal/30',
  Reservation: 'text-sun bg-sun/10 border-sun/30',
  Issue: 'text-sun bg-sun/10 border-sun/30',
  Return: 'text-teal bg-teal/10 border-teal/30',
  Adjustment: 'text-text-dim bg-black/[0.035] border-border',
  Damage: 'text-rose bg-rose/10 border-rose/30',
  Missing: 'text-rose bg-rose/10 border-rose/30',
  Transfer: 'text-text-dim bg-black/[0.035] border-border',
}

export default function MovementHistory() {
  const { stockMovements } = useApp()
  const [type, setType] = useState<(typeof TYPES)[number]>('All')

  const filtered = useMemo(() => stockMovements.filter((m) => type === 'All' || m.type === type), [stockMovements, type])

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Warehouse → Audit" title="Stock Movement History" action={<span className="text-xs text-text-dim">{filtered.length} of {stockMovements.length}</span>} />

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TYPES.map((t) => {
          const count = stockMovements.filter((m) => t === 'All' || m.type === t).length
          return (
            <button key={t} onClick={() => setType(t)} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${type === t ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}>
              {t} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No movements" message="No stock movements match this filter." />
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text truncate">{m.itemName}</div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {m.quantity} {m.unit} · {formatDate(m.date)} · {m.performedBy}
                    {m.projectCode ? ` · ${m.projectCode}` : ''}
                  </div>
                  {m.notes && <div className="text-xs text-text-dim mt-1 italic">{m.notes}</div>}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${TYPE_TINT[m.type] ?? ''}`}>{m.type}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
