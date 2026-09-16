import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { startFlagIcon, endFlagIcon } from './mapIcons'
import type { FieldMovementLocation } from '../../types/models'

const DEFAULT_CENTER: [number, number] = [10.7905, 78.7047]

const R = 6371e3
function distanceMeters(a: FieldMovementLocation, b: FieldMovementLocation) {
  const toRad = (v: number) => (v * Math.PI) / 180
  const f1 = toRad(a.latitude)
  const f2 = toRad(b.latitude)
  const df = toRad(b.latitude - a.latitude)
  const dl = toRad(b.longitude - a.longitude)
  const x = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)))
}

export function totalRouteDistanceMeters(points: FieldMovementLocation[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i])
  return total
}

export function HistoryRouteMap({ points }: { points: FieldMovementLocation[] }) {
  const path = useMemo<[number, number][]>(() => points.map((p) => [p.latitude, p.longitude]), [points])

  const center = path.length ? path[Math.floor(path.length / 2)] : DEFAULT_CENTER

  if (points.length === 0) {
    return (
      <div className="border border-border rounded-lg h-[360px] bg-black/[0.02] flex items-center justify-center text-xs text-text-dim">
        No GPS points were recorded for this session.
      </div>
    )
  }

  const start = points[0]
  const end = points[points.length - 1]

  return (
    <div className="border border-border rounded-lg overflow-hidden h-[360px] bg-black/[0.02]">
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={path} pathOptions={{ color: '#F59E0B', weight: 4, opacity: 0.85 }} />
        <Marker position={[start.latitude, start.longitude]} icon={startFlagIcon}>
          <Popup>Start · {new Date(start.capturedAt).toLocaleTimeString()}</Popup>
        </Marker>
        {points.length > 1 && (
          <Marker position={[end.latitude, end.longitude]} icon={endFlagIcon}>
            <Popup>End · {new Date(end.capturedAt).toLocaleTimeString()}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
