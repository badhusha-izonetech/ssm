import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../api/client'

export interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * Read-only counterpart to useSiteVisitTracking, generalized to any
 * FieldMovement tracking session (added in Phase 1) rather than just Site
 * Visits. The CEO/manager side only ever listens — it never sends GPS —
 * mirroring the !isFieldWorker branch of useSiteVisitTracking.ts exactly,
 * just against /field-movements/{id}/tracking instead of /site-visits.
 */
export function useFieldMovementTracking(fieldMovementId: string | undefined, active: boolean) {
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const wsBase = API_BASE_URL.replace(/^http/, 'ws')

  useEffect(() => {
    if (!active || !fieldMovementId) {
      if (wsRef.current) {
        const currentWs = wsRef.current

        if (
          currentWs.readyState === WebSocket.OPEN ||
          currentWs.readyState === WebSocket.CLOSING
        ) {
          currentWs.close(1000, 'Tracking component inactive')
        }

        wsRef.current = null
      }

      setWsStatus('disconnected')
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      setError('Not authenticated for live tracking')
      return
    }

    setWsStatus('connecting')
    const ws = new WebSocket(`${wsBase}/field-movements/${fieldMovementId}/tracking?token=${token}`)
    wsRef.current = ws
    let isActive = true

    ws.onopen = () => {
      if (!isActive) return
      setWsStatus('connected')
      setError(null)
    }

    ws.onclose = () => {
      if (!isActive) return
      setWsStatus('disconnected')
    }

    ws.onerror = () => {
      if (!isActive) return
      setError('Live tracking connection error')
    }

    ws.onmessage = (event) => {
      if (!isActive) return

      try {
        const data = JSON.parse(event.data)

        if (data.error) {
          setError(data.error)
          return
        }

        if (
          typeof data.latitude !== 'number' ||
          typeof data.longitude !== 'number'
        ) {
          return
        }

        setCurrentLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          timestamp: data.timestamp
            ? new Date(data.timestamp).getTime()
            : Date.now(),
        })

        setLastUpdated(new Date())
      } catch (e) {
        console.error('WS parse error', e)
      }
    }

    return () => {
      isActive = false

      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CLOSING
      ) {
        ws.close(1000, 'Tracking component unmounted')
      }

      if (wsRef.current === ws) {
        wsRef.current = null
      }
    }
  }, [active, fieldMovementId, wsBase])

  return { currentLocation, lastUpdated, wsStatus, error }
}
