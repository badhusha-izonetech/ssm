import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill, EmptyState } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { formatINR, formatDate } from '../../lib/utils'
import { AlertTriangle } from 'lucide-react'

export default function WarehouseDashboard() {
  const { stockItems, stockRequests, stockMovements } = useApp()
  const { employee } = useAuth()
  const navigate = useNavigate()

  const lowStock = useMemo(() => stockItems.filter((s) => s.availableQuantity <= s.minimumLevel), [stockItems])
  const pendingRequests = useMemo(() => stockRequests.filter((r) => r.status === 'Requested'), [stockRequests])
  const reservedAwaitingIssue = useMemo(() => stockRequests.filter((r) => r.status === 'Reserved'), [stockRequests])
  const shortageFlags = useMemo(() => stockRequests.filter((r) => r.status === 'Shortage Flagged'), [stockRequests])
  const totalValue = stockItems.reduce((s, i) => s + i.currentQuantity * i.costPerUnit, 0)
  const todayMovements = stockMovements.filter((m) => m.date === new Date().toISOString().slice(0, 10))

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Warehouse"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle="Inventory Master, Stock Inward/Outward & Project Allocations"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => navigate('/warehouse/products')} className="text-left"><KpiCard label="Inventory Value" value={formatINR(totalValue)} accent="sun" /></button>
        <button onClick={() => navigate('/warehouse/products')} className="text-left"><KpiCard label="Low Stock Items" value={String(lowStock.length)} accent="rose" /></button>
        <button onClick={() => navigate('/warehouse/requests')} className="text-left"><KpiCard label="Pending Requests" value={String(pendingRequests.length)} accent="sun" /></button>
        <button onClick={() => navigate('/warehouse/requests')} className="text-left"><KpiCard label="Reserved, Awaiting Issue" value={String(reservedAwaitingIssue.length)} accent="teal" /></button>
      </div>

      <Card className="p-4">
        <SectionHeading
          eyebrow="Action Needed"
          title="Stock Requests Queue"
          action={<span className="text-xs text-text-dim">{pendingRequests.length + reservedAwaitingIssue.length} pending</span>}
        />
        {pendingRequests.length === 0 && reservedAwaitingIssue.length === 0 ? (
          <EmptyState title="Queue is clear" message="No project stock requests are waiting on reservation or issue right now." />
        ) : (
          <div className="space-y-2">
            {[...pendingRequests, ...reservedAwaitingIssue].slice(0, 6).map((r) => (
              <div key={r.id} onClick={() => navigate('/warehouse/requests')} className="flex items-center justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 cursor-pointer hover:bg-black/[0.02] -mx-1 px-1 rounded-lg transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.itemName}</div>
                  <div className="text-xs text-text-dim">{r.projectCode} · {r.requiredQuantity} {r.unit} · Requested by {r.requestedBy}</div>
                </div>
                <Pill status={r.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionHeading eyebrow="Reorder Alert" title="Low Stock Items" action={<span className="text-xs text-text-dim">{lowStock.length} below minimum</span>} />
          {lowStock.length === 0 ? (
            <div className="text-xs text-text-dim">All items are above their minimum stock level.</div>
          ) : (
            <div className="space-y-2">
              {lowStock.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-rose shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.productName}</div>
                      <div className="text-xs text-text-dim">{s.brand} · {s.model}</div>
                    </div>
                  </div>
                  <div className="text-xs text-rose font-medium whitespace-nowrap">{s.availableQuantity} / {s.minimumLevel} {s.unit}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeading eyebrow="Today" title="Stock Movements" action={<span className="text-xs text-text-dim">{todayMovements.length} today</span>} />
          {todayMovements.length === 0 ? (
            <div className="text-xs text-text-dim">No stock movements recorded today yet.</div>
          ) : (
            <div className="space-y-2">
              {todayMovements.slice(0, 6).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.itemName}</div>
                    <div className="text-xs text-text-dim">{m.projectCode ? `${m.projectCode} · ` : ''}{formatDate(m.date)} · {m.performedBy}</div>
                  </div>
                  <div className="text-xs font-medium whitespace-nowrap">{m.type} · {m.quantity} {m.unit}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {shortageFlags.length > 0 && (
        <Card className="p-4 border-rose/30">
          <SectionHeading eyebrow="Escalation" title="Shortage Flags Raised to CEO" action={<span className="text-xs text-rose">{shortageFlags.length} flagged</span>} />
          <div className="space-y-2">
            {shortageFlags.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.itemName}</div>
                  <div className="text-xs text-text-dim">{r.projectCode} · needs {r.requiredQuantity} {r.unit}{r.notes ? ` · ${r.notes}` : ''}</div>
                </div>
                <Pill status={r.status} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
