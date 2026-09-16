import { useEffect, useRef, useState } from 'react'
import { Modal } from '../shared/Primitives'
import { formatDate } from '../../lib/utils'

export interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface FieldCameraModalProps {
  onClose: () => void
  onUpload: (blob: Blob, lat: number, lng: number, accuracy: number) => Promise<void>
  taskName: string
  currentLocation: string
}

export function FieldCameraModal({ onClose, onUpload, taskName, currentLocation }: FieldCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const streamRef = useRef<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  
  const [captureData, setCaptureData] = useState<{lat: number, lng: number, accuracy: number} | null>(null)

  useEffect(() => {
    let isMounted = true;
    async function initCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        })
        if (!isMounted) {
          s.getTracks().forEach(t => t.stop())
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }
      } catch (err: any) {
        if (isMounted) setCamError("Camera access denied or unavailable: " + err.message)
      }
    }
    initCamera()
    
    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [])
  
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return
    setError(null)
    
    let position: GeolocationPosition
    try {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        })
      })
    } catch (err: any) {
      setError("Failed to get GPS location: " + err.message)
      return
    }
    
    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    }
    
    if (location.accuracy > 5000) {
      setError(`GPS accuracy is too low (${Math.round(location.accuracy)}m). Please move to an open area and try again.`)
      return
    }
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    const targetAspect = 3 / 4;
    const videoAspect = video.videoWidth / video.videoHeight;
    
    let drawWidth = video.videoWidth;
    let drawHeight = video.videoHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > targetAspect) {
      drawWidth = video.videoHeight * targetAspect;
      offsetX = (video.videoWidth - drawWidth) / 2;
    } else {
      drawHeight = video.videoWidth / targetAspect;
      offsetY = (video.videoHeight - drawHeight) / 2;
    }
    
    canvas.width = drawWidth
    canvas.height = drawHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Draw cropped video frame
    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight, 0, 0, drawWidth, drawHeight)
    
    // Draw Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, canvas.height - 200, canvas.width, 200)
    
    ctx.fillStyle = 'white'
    ctx.textAlign = 'left'
    ctx.font = 'bold 22px Arial'
    ctx.fillText('SUCCESS SOLAR POWER CARE', 20, canvas.height - 160)
    
    const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;
    
    ctx.font = '15px Arial'
    ctx.fillText(`Task: ${truncate(taskName, 30)}`, 20, canvas.height - 130)
    ctx.fillText(`Loc: ${truncate(currentLocation, 30)}`, 20, canvas.height - 105)
    
    ctx.fillText(`Lat: ${location.latitude.toFixed(6)}`, 20, canvas.height - 70)
    ctx.fillText(`Lng: ${location.longitude.toFixed(6)}`, 20, canvas.height - 45)
    
    const dateStr = formatDate(new Date(location.timestamp).toISOString().slice(0, 10))
    const timeStr = new Date(location.timestamp).toLocaleTimeString('en-IN')
    
    ctx.textAlign = 'right'
    ctx.fillText(`Date: ${dateStr}`, canvas.width - 20, canvas.height - 130)
    ctx.fillText(`Time: ${timeStr}`, canvas.width - 20, canvas.height - 105)
    ctx.fillText(`GPS Accuracy: ${Math.round(location.accuracy)}m`, canvas.width - 20, canvas.height - 70)
    
    ctx.textAlign = 'left'
    
    // Get Blob
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedImage(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        setCaptureData({ lat: location.latitude, lng: location.longitude, accuracy: location.accuracy })
      }
    }, 'image/jpeg', 0.8)
  }
  
  const handleRetake = () => {
    setCapturedImage(null)
    setCaptureData(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }
  
  const handleUsePhoto = async () => {
    if (!capturedImage || !captureData) return
    setUploading(true)
    setError(null)
    try {
      await onUpload(capturedImage, captureData.lat, captureData.lng, captureData.accuracy)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo')
      setUploading(false)
    }
  }

  return (
    <Modal title="Field Mobility Camera" onClose={onClose} wide>
      {camError ? (
        <div className="p-4 text-center text-rose">
          {camError}
          <div className="mt-4 text-xs text-text-dim">Camera access is required to capture geotagged field photos.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {!previewUrl ? (
            <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center w-full max-w-sm mx-auto aspect-[3/4]">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 right-2 p-2 bg-black/50 text-white text-xs rounded pointer-events-none">
                <div className="font-bold mb-1">LIVE GEO-CAMERA</div>
                <div>Location and timestamp will be burned into the image.</div>
              </div>
            </div>
          ) : (
            <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center w-full max-w-sm mx-auto aspect-[3/4]">
              <img src={previewUrl} alt="Captured" className="w-full h-full object-cover" />
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
          
          {error && <div className="text-xs text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</div>}
          
          <div className="flex justify-between items-center pt-2">
            {!previewUrl ? (
              <>
                <button type="button" onClick={onClose} className="text-xs text-text-dim px-3 py-2">Cancel</button>
                <button 
                  type="button" 
                  onClick={capturePhoto} 
                  className="bg-sun text-ink text-sm font-semibold px-6 py-3 rounded-lg hover:bg-sun-deep transition-colors"
                >
                  Capture Photo
                </button>
              </>
            ) : (
              <>
                <button 
                  type="button" 
                  onClick={handleRetake} 
                  disabled={uploading}
                  className="text-xs text-text px-4 py-2 bg-panel-raised border border-border rounded-lg hover:bg-black/[0.05]"
                >
                  Retake
                </button>
                <button 
                  type="button" 
                  onClick={handleUsePhoto} 
                  disabled={uploading}
                  className="bg-teal text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2"
                >
                  {uploading ? 'Uploading...' : 'Use Photo'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
