import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/AppStore'
import { Card, SectionHeading, Pill, Modal } from '../components/shared/Primitives'
import { MapPin, Navigation, Clock, Search, Route as RouteIcon } from 'lucide-react'
import { LiveFieldMap } from '../components/fieldmovement/LiveFieldMap'
import { HistoryRouteMap, totalRouteDistanceMeters } from '../components/fieldmovement/HistoryRouteMap'
import { fieldWorkApi } from '../api/fieldWork'
import type { FieldMovement, FieldMovementLocation } from '../types/models'

const ACTIVE_STATUSES: FieldMovement['status'][] = ['Checked In', 'On Field', 'Returning']
const LIVE_POLL_INTERVAL_MS = 15000

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 0) return 'just now'
  const s = Math.floor(diffMs / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function HistoryDetailModal({ movement, onClose }: { movement: FieldMovement; onClose: () => void }) {
  const [points, setPoints] = useState<FieldMovementLocation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPoints(null)
    setError(null)
    fieldWorkApi
      .getLocationHistory(movement.id, 300)
      .then((data) => !cancelled && setPoints(data))
      .catch((err) => !cancelled && setError(err?.message || 'Could not load route history'))
    return () => {
      cancelled = true
    }
  }, [movement.id])

  const distanceKm = points ? totalRouteDistanceMeters(points) / 1000 : null

  return (
    <Modal title={`Route — ${movement.employeeName}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-dim">
          <span>{movement.purpose ? movement.purpose : movement.destination || 'Field visit'}</span>
          <span>Started {new Date(movement.startTime).toLocaleString()}</span>
          {movement.lastUpdate && <span>Ended {new Date(movement.lastUpdate).toLocaleString()}</span>}
          {distanceKm !== null && <span className="text-teal font-medium">{distanceKm.toFixed(2)} km recorded</span>}
          {points && <span>{points.length} GPS points (downsampled for display)</span>}
        </div>

        {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
        {!error && (points === null ? (
          <div className="h-[360px] flex items-center justify-center text-xs text-text-dim border border-border rounded-lg bg-black/[0.02]">
            Loading route…
          </div>
        ) : (
          <HistoryRouteMap points={points} />
        ))}
      </div>
    </Modal>
  )
}

export default function FieldMovement() {
  const { fieldMovements, refreshFieldMovements } = useApp()
  const [tab, setTab] = useState<'live' | 'history'>('live')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('All Roles')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [historyTarget, setHistoryTarget] = useState<FieldMovement | null>(null)

  // Keep the live list (and each card's last-known position) fresh while the
  // Live tab is open. Per-marker WebSockets on the map handle the smoother
  // real-time motion; this polling covers status changes, new sessions
  // starting, and sessions ending, none of which the map subscriptions alone
  // would surface without a page reload.
  useEffect(() => {
    if (tab !== 'live') return
    const interval = setInterval(() => {
      refreshFieldMovements()
    }, LIVE_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [tab, refreshFieldMovements])

  const roles = useMemo(() => ['All Roles', ...Array.from(new Set(fieldMovements.map((f) => f.role)))], [fieldMovements])

  const filtered = useMemo(() => {
    return fieldMovements
      .filter((f) => (tab === 'live' ? ACTIVE_STATUSES.includes(f.status) : f.status === 'Checked Out'))
      .filter((f) => role === 'All Roles' || f.role === role)
      .filter((f) => !query.trim() || f.employeeName.toLowerCase().includes(query.trim().toLowerCase()) || f.currentLocation?.toLowerCase().includes(query.trim().toLowerCase()))
  }, [fieldMovements, tab, role, query])

  const liveWithGps = tab === 'live' ? filtered : []

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Common Module" title="Field Mobility / Employee Movement" action={<span className="text-xs text-text-dim">Live GPS tracking</span>} />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl p-1 bg-panel-raised border border-border w-fit shadow-xs">
          <button
            onClick={() => setTab('live')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'live' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'
            }`}
          >
            Live ({fieldMovements.filter((f) => ACTIVE_STATUSES.includes(f.status)).length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'history' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'
            }`}
          >
            Historical Route
          </button>
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-xs font-medium px-3 py-2 rounded-xl bg-panel border border-border shadow-xs outline-none focus:border-emerald-500 transition"
        >
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee or location…"
            className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl bg-panel border border-border shadow-xs outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {tab === 'live' && <LiveFieldMap movements={liveWithGps} />}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-xs text-text-dim border-dashed">No {tab === 'live' ? 'employees currently on field' : 'historical visits'} match this filter.</Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((f) => (
            <Card key={f.id} className="p-5 space-y-3.5 hover:border-emerald-200 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-text">{f.employeeName}</div>
                  <div className="text-xs text-text-dim">{f.role}</div>
                </div>
                <Pill status={f.status} />
              </div>

              <div className="flex items-center gap-2.5 text-sm">
                <MapPin size={16} className="text-emerald-600 shrink-0" />
                <span className="font-medium text-text">{f.currentLocation || (f.lastLatitude != null ? `${f.lastLatitude.toFixed(5)}, ${f.lastLongitude?.toFixed(5)}` : 'No GPS fix yet')}</span>
                <span className="relative flex h-2.5 w-2.5 ml-auto">
                  {(f.status === 'On Field' || f.status === 'Returning') && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${f.status === 'Checked Out' ? 'bg-slate-400' : 'bg-emerald-600'}`} />
                </span>
              </div>

              {tab === 'live' && (
                <div className="text-xs text-text-dim">
                  GPS last update: {timeAgo(f.lastLocationAt)}
                  {f.lastAccuracy != null && ` · ±${Math.round(f.lastAccuracy)}m`}
                </div>
              )}

              {f.destination && (
                <div className="flex items-center gap-2 text-xs text-text-dim">
                  <Navigation size={13} className="shrink-0 text-emerald-600" /> {tab === 'live' ? 'Heading to' : 'Task'} {f.destination}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-text-dim">
                <Clock size={13} className="shrink-0" /> Started {f.startTime} · Last update {f.lastUpdate}
              </div>

              {tab === 'history' && (
                <button
                  onClick={() => setHistoryTarget(f)}
                  type="button"
                  className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-border text-slate-700 hover:bg-slate-50 transition shadow-xs"
                >
                  <RouteIcon size={14} className="text-emerald-600" /> View recorded route
                </button>
              )}

              <div className="pt-3 border-t border-border">
                <div className="text-[10px] uppercase tracking-wide text-text-dim font-semibold mb-2">Visit Log</div>
                <div className="space-y-1.5">
                  {(f.routeHistory ?? []).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                      <span className="text-text-dim w-16 shrink-0">{r.time}</span>
                      <span className="truncate text-text font-medium">{r.location}</span>
                    </div>
                  ))}
                </div>

                {f.visitNotes && f.visitNotes.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-border/60 space-y-1">
                    {f.visitNotes.map((n, i) => (
                      <div key={i} className="text-xs text-text-dim italic bg-panel-raised/80 p-2 rounded-lg">"{n}"</div>
                    ))}
                  </div>
                )}

                {f.photos && f.photos.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-border/60">
                    <div className="text-[10px] uppercase tracking-wide text-text-dim font-semibold mb-2">Geo-Tagged Evidence</div>
                    <div className="grid grid-cols-2 gap-2">
                      {f.photos.map((p, i) => (
                        <button key={i} onClick={() => setSelectedPhoto(p)} type="button" className="block w-full overflow-hidden rounded-xl border border-border bg-black text-left shadow-xs">
                          <img src={p} alt="Field Evidence" className="w-full h-36 object-cover hover:opacity-80 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <Modal title="Geo-Tagged Evidence" onClose={() => setSelectedPhoto(null)} wide>
          <img src={selectedPhoto} alt="Evidence Full" className="w-full h-auto rounded-lg object-contain bg-black" />
        </Modal>
      )}

      {historyTarget && <HistoryDetailModal movement={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  )
}
