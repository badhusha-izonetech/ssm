import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { fieldWorkerIcon } from './mapIcons'
import { useFieldMovementTracking } from '../../hooks/useFieldMovementTracking'
import type { FieldMovement } from '../../types/models'

const DEFAULT_CENTER: [number, number] = [10.7905, 78.7047] // Tiruchirappalli, matches other map defaults in this app

/**
 * One marker per active field movement. Each marker subscribes to its own
 * live WebSocket (the generalized /field-movements/{id}/tracking endpoint
 * from Phase 1) so positions update in real time without polling; it starts
 * from the record's last known position (last_latitude/longitude) so a
 * marker still shows up immediately even before the first live frame
 * arrives after page load.
 */
function LiveMarker({ movement }: { movement: FieldMovement }) {
  const { currentLocation } = useFieldMovementTracking(movement.id, true)

  const lat = currentLocation?.latitude ?? movement.lastLatitude ?? undefined
  const lng = currentLocation?.longitude ?? movement.lastLongitude ?? undefined
  if (lat === undefined || lng === undefined) return null

  return (
    <Marker position={[lat, lng]} icon={fieldWorkerIcon}>
      <Popup>
        <strong>{movement.employeeName}</strong><br />
        {movement.role}<br />
        {movement.status}<br />
        {movement.destination || movement.currentLocation}
      </Popup>
    </Marker>
  )
}

export function LiveFieldMap({ movements }: { movements: FieldMovement[] }) {
  const withPosition = movements.filter((m) => m.lastLatitude != null && m.lastLongitude != null)

  const center = useMemo<[number, number]>(() => {
    if (withPosition.length === 0) return DEFAULT_CENTER
    return [withPosition[0].lastLatitude as number, withPosition[0].lastLongitude as number]
  }, [withPosition])

  return (
    <div className="border border-border rounded-lg overflow-hidden h-[420px] bg-black/[0.02]">
      <MapContainer center={center} zoom={withPosition.length ? 12 : 11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {movements.map((m) => (
          <LiveMarker key={m.id} movement={m} />
        ))}
      </MapContainer>
    </div>
  )
}
