import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Same fix already applied in SiteVisitDetail.tsx — Leaflet's default marker
// image paths break under bundlers unless overridden explicitly.
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

export const fieldWorkerIcon = L.divIcon({
  html: '<div style="font-size: 26px; line-height: 26px; text-align: center; margin-left: -13px; margin-top: -13px;">🧑‍🔧</div>',
  className: 'bg-transparent border-none',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

export const startFlagIcon = L.divIcon({
  html: '<div style="font-size: 22px; line-height: 22px; text-align: center; margin-left: -11px; margin-top: -22px;">🟢</div>',
  className: 'bg-transparent border-none',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

export const endFlagIcon = L.divIcon({
  html: '<div style="font-size: 22px; line-height: 22px; text-align: center; margin-left: -11px; margin-top: -22px;">🏁</div>',
  className: 'bg-transparent border-none',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

export { L }
