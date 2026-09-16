import { useState, useEffect, useRef, useCallback } from 'react'

export interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

const R = 6371e3 // Earth radius in meters
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (val: number) => (val * Math.PI) / 180
  const f1 = toRad(lat1)
  const f2 = toRad(lat2)
  const df = toRad(lat2 - lat1)
  const dl = toRad(lon2 - lon1)

  const a = Math.sin(df / 2) * Math.sin(df / 2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

import { API_BASE_URL } from '../api/client'

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

export function useSiteVisitTracking(
  visitId: string | undefined,
  active: boolean,
  isFieldWorker: boolean,
  customerLat?: number,
  customerLng?: number
) {
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null)
  const [distance, setDistance] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')
  
  const watchIdRef = useRef<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const latestLocRef = useRef<GeoLocation | null>(null)
  const lastSendTimeRef = useRef<number>(0)
  
  const wsBase = API_BASE_URL.replace(/^http/, 'ws')
  const wsUrl = `${wsBase}/site-visits/${visitId}/tracking`

  useEffect(() => {
    if (!active || !visitId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
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
    // Connect WebSocket
    const ws = new WebSocket(`${wsUrl}?token=${token}`)
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

    ws.onmessage = (event) => {
      if (!isActive) return
      try {
        const data = JSON.parse(event.data)
        if (data.error) {
          setError(data.error)
          return
        }
        
        // If we are CEO (not Field Worker), we update location from WS
        if (!isFieldWorker) {
          const loc: GeoLocation = {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            timestamp: new Date(data.timestamp).getTime()
          }
          setCurrentLocation(loc)
          setLastUpdated(new Date())
          
          if (customerLat !== undefined && customerLng !== undefined) {
            setDistance(getDistance(loc.latitude, loc.longitude, customerLat, customerLng))
          }
        }
      } catch (e) {
        console.error("WS parse error", e)
      }
    }

    if (!isFieldWorker) {
      // Debug helper for demonstration
      ;(window as any).simulateGpsMove = (lat: number, lng: number) => {
        if (!isActive) return
        const loc: GeoLocation = {
          latitude: lat,
          longitude: lng,
          accuracy: 5,
          timestamp: Date.now()
        }
        setCurrentLocation(loc)
        setLastUpdated(new Date())
      }
    }
    
    ws.onerror = () => {
      if (!isActive) return
      setError("Live tracking connection error")
    }

    // If Field Worker, start GPS tracking
    if (isFieldWorker) {
      if (!('geolocation' in navigator)) {
        setError('Geolocation is not supported by your browser')
      } else {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            setError(null)
            const loc = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            }
            setCurrentLocation(loc)
            latestLocRef.current = loc
            setLastUpdated(new Date())
            
            if (customerLat !== undefined && customerLng !== undefined) {
              setDistance(getDistance(loc.latitude, loc.longitude, customerLat, customerLng))
            }
          },
          (err) => {
            setError(err.message)
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
          }
        )
      }
    }

    return () => {
      isActive = false
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [active, visitId, isFieldWorker, customerLat, customerLng, wsUrl])

  // Periodic broadcast to keep CEO view alive and ensure first location is sent
  useEffect(() => {
    if (!isFieldWorker || wsStatus !== 'connected') return
    
    const sendPing = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN && latestLocRef.current) {
        wsRef.current.send(JSON.stringify({
          latitude: latestLocRef.current.latitude,
          longitude: latestLocRef.current.longitude,
          accuracy: latestLocRef.current.accuracy,
          timestamp: new Date(latestLocRef.current.timestamp).toISOString()
        }))
        lastSendTimeRef.current = Date.now()
      }
    }

    // Send immediately on connect if we already have a location
    if (latestLocRef.current && Date.now() - lastSendTimeRef.current > 5000) {
      sendPing()
    }
    
    // Then ping every 5 seconds to prevent stale status when stationary
    const interval = setInterval(sendPing, 5000)
    return () => clearInterval(interval)
  }, [isFieldWorker, wsStatus])

  // Single immediate fetch for starting or camera validation
  const getFreshLocation = useCallback((): Promise<{ location: GeoLocation, distance?: number }> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          }
          let dist = undefined
          if (customerLat !== undefined && customerLng !== undefined) {
            dist = getDistance(loc.latitude, loc.longitude, customerLat, customerLng)
          }
          resolve({ location: loc, distance: dist })
        },
        () => reject(new Error('Location permission denied')),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      )
    })
  }, [customerLat, customerLng])

  return { currentLocation, distance, error, getFreshLocation, lastUpdated, wsStatus }
}
