import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, Field, inputCls, EmptyState } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'
import { PackagePlus, PackageMinus, AlertTriangle, HelpCircle, ArrowLeftRight, Undo2 } from 'lucide-react'

const OPS = [
  { key: 'Receipt', label: 'Stock Receipt', icon: PackagePlus, tint: 'teal', helper: 'Record new stock arriving into the warehouse from a supplier.' },
  { key: 'Return', label: 'Return', icon: Undo2, tint: 'teal', helper: 'Record unused project material returned by a field technician.' },
  { key: 'Adjustment', label: 'Adjustment', icon: PackageMinus, tint: 'sun', helper: 'Correct a stock count mismatch found during a physical count.' },
  { key: 'Damage', label: 'Damage', icon: AlertTriangle, tint: 'rose', helper: 'Write off stock damaged in storage or transit.' },
  { key: 'Missing', label: 'Missing', icon: HelpCircle, tint: 'rose', helper: 'Write off stock that cannot be located during a count.' },
  { key: 'Transfer', label: 'Transfer', icon: ArrowLeftRight, tint: 'sun', helper: 'Log a stock transfer to another storage location (mock — no multi-location inventory yet).' },
] as const

type OpKey = (typeof OPS)[number]['key']

export default function StockOperations() {
  const { stockItems, projects, projectAllocations, receiveStock, returnMaterial, recordStockAdjustment, recordStockTransfer, stockMovements } = useApp()
  const { employee } = useAuth()
  const [active, setActive] = useState<OpKey>('Receipt')

  const [itemId, setItemId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')

  const activeMeta = OPS.find((o) => o.key === active)!
  const selectedItem = stockItems.find((s) => s.id === itemId)
  const qty = Number(quantity)

  const projectOptionsForItem = useMemo(
    () => (active === 'Return' && itemId ? projectAllocations.filter((a) => a.itemId === itemId && a.issuedQuantity - a.returnedQuantity > 0) : []),
    [active, itemId, projectAllocations],
  )

  const recent = useMemo(() => stockMovements.filter((m) => m.type === active).slice(0, 6), [stockMovements, active])

  function reset() {
    setItemId(''); setProjectId(''); setQuantity(''); setSupplier(''); setNotes('')
  }

  function handleSubmit() {
    if (!selectedItem || !(qty > 0) || !employee) return
    if (active === 'Receipt') {
      receiveStock({ itemId: selectedItem.id, quantity: qty, performedBy: employee.name, supplier: supplier.trim() || undefined, notes: notes.trim() || undefined })
    } else if (active === 'Return') {
      if (!projectId) return
      returnMaterial({ projectId, itemId: selectedItem.id, quantity: qty, performedBy: employee.name, notes: notes.trim() || undefined })
    } else if (active === 'Adjustment' || active === 'Damage' || active === 'Missing') {
      recordStockAdjustment({ itemId: selectedItem.id, type: active, quantity: qty, performedBy: employee.name, notes: notes.trim() || undefined })
    } else if (active === 'Transfer') {
      recordStockTransfer({ itemId: selectedItem.id, quantity: qty, performedBy: employee.name, notes: notes.trim() || undefined })
    }
    reset()
  }

  const exceedsCurrent = !!selectedItem && active !== 'Receipt' && active !== 'Return' && qty > selectedItem.currentQuantity
  const canSubmit = !!selectedItem && qty > 0 && (active !== 'Return' || !!projectId) && !exceedsCurrent

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Warehouse → Operations" title="Stock Operations" />

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {OPS.map((op) => (
          <button
            key={op.key}
            onClick={() => { setActive(op.key); reset() }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${active === op.key ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}
          >
            <op.icon size={13} /> {op.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-4 lg:col-span-3">
          <div className="text-xs text-text-dim mb-4">{activeMeta.helper}</div>
          <div className="space-y-4">
            <Field label="Product">
              <select value={itemId} onChange={(e) => { setItemId(e.target.value); setProjectId('') }} className={inputCls}>
                <option value="">Select product…</option>
                {stockItems.map((s) => <option key={s.id} value={s.id}>{s.productName} ({s.brand})</option>)}
              </select>
            </Field>

            {selectedItem && (
              <div className="text-xs text-text-dim bg-panel-raised border border-border rounded-lg p-3 grid grid-cols-3 gap-2">
                <div><div className="text-text-dim">Current</div><div className="font-medium text-text">{selectedItem.currentQuantity} {selectedItem.unit}</div></div>
                <div><div className="text-text-dim">Reserved</div><div className="font-medium text-sun">{selectedItem.reservedQuantity} {selectedItem.unit}</div></div>
                <div><div className="text-text-dim">Available</div><div className="font-medium text-teal">{selectedItem.availableQuantity} {selectedItem.unit}</div></div>
              </div>
            )}

            {active === 'Return' && (
              <Field label="Project (issued balance not yet returned)">
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls} disabled={!itemId}>
                  <option value="">Select project…</option>
                  {projectOptionsForItem.map((a) => (
                    <option key={a.id} value={a.projectId}>{a.projectCode} — balance {a.issuedQuantity - a.usedQuantity - a.returnedQuantity} {a.unit}</option>
                  ))}
                </select>
                {itemId && projectOptionsForItem.length === 0 && (
                  <div className="text-xs text-text-dim mt-1">No project currently holds unreturned issued stock of this item.</div>
                )}
              </Field>
            )}

            <Field label={`Quantity${selectedItem ? ` (${selectedItem.unit})` : ''}`}>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
            </Field>
            {exceedsCurrent && <div className="text-xs text-rose -mt-2">Quantity exceeds current on-hand stock ({selectedItem?.currentQuantity} {selectedItem?.unit}).</div>}

            {active === 'Receipt' && (
              <Field label="Supplier / Purchase Reference"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls} /></Field>
            )}

            <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="e.g. reason, evidence reference, physical count details" /></Field>

            <button disabled={!canSubmit} onClick={handleSubmit} className={`w-full font-semibold text-sm rounded-xl py-2.5 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${activeMeta.tint === 'rose' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
              Record {activeMeta.label}
            </button>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionHeading eyebrow="Log" title={`Recent ${activeMeta.label}`} />
          {recent.length === 0 ? (
            <EmptyState title="No entries yet" message={`No ${activeMeta.label.toLowerCase()} movements recorded yet.`} />
          ) : (
            <div className="space-y-2">
              {recent.map((m) => (
                <div key={m.id} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="text-sm font-medium truncate">{m.itemName}</div>
                  <div className="text-xs text-text-dim">{m.quantity} {m.unit} · {formatDate(m.date)} · {m.performedBy}</div>
                  {m.projectCode && <div className="text-xs text-text-dim">{m.projectCode}</div>}
                  {m.notes && <div className="text-xs text-text-dim italic mt-0.5">{m.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {projects.length > 0 && active === 'Transfer' && (
        <Card className="p-3 text-[11px] text-text-dim">
          Transfer is logged for audit purposes only in this frontend-only build — it does not move quantity between locations since multi-warehouse locations are out of scope for this phase.
        </Card>
      )}
    </div>
  )
}
