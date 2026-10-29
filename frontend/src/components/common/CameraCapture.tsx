import { Camera, RefreshCw, SwitchCamera } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera access is blocked. Allow the camera from the icon in your address bar, or choose a photo instead.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.'
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.'
  return 'The camera could not be started. Choose a photo from your device instead.'
}

/**
 * Live camera for laptops and desktops: preview, take a photo, retake or use it.
 * The camera turns off as soon as the dialog closes or a photo is taken.
 */
export function CameraCapture({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraIndex, setCameraIndex] = useState(0)
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(
    async (index: number) => {
      stop()
      setError(null)
      setStarting(true)
      try {
        const deviceId = cameras[index]?.deviceId
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        // Device labels are only available after permission is granted.
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
        setCameras(devices)
      } catch (err) {
        setError(cameraErrorMessage(err))
      } finally {
        setStarting(false)
      }
    },
    [cameras, stop],
  )

  // Turn the camera on when the dialog opens, and always off when it closes or unmounts.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void start(cameraIndex), 0)
    return () => {
      window.clearTimeout(timer)
      stop()
    }
    // Restart only when opening or switching camera, not when the device list updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cameraIndex])

  const close = (next: boolean) => {
    if (!next) {
      stop()
      setShot(null)
      setError(null)
    }
    onOpenChange(next)
  }

  const takePhoto = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('That photo could not be saved. Try again.')
          return
        }
        const file = new File([blob], `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, {
          type: 'image/jpeg',
        })
        setShot({ file, url: URL.createObjectURL(blob) })
        stop()
      },
      'image/jpeg',
      0.9,
    )
  }

  const retake = () => {
    setShot(null)
    void start(cameraIndex)
  }

  const usePhoto = () => {
    if (!shot) return
    onCapture(shot.file)
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>Hold the item in good light and fill the frame with it.</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-panel border border-line bg-ink">
          {/* The video stays mounted so "Retake" can reattach the camera straight away. */}
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Live camera preview"
            className={shot ? 'hidden' : 'aspect-[4/3] w-full object-contain'}
          />
          {shot && <img src={shot.url} alt="Photo you just took" className="aspect-[4/3] w-full object-contain" />}
          {starting && !shot && (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white" role="status">
              Starting the camera. If your browser asks, choose Allow.
            </p>
          )}
        </div>
        {error && (
          <div className="mt-3">
            <FieldError>{error}</FieldError>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {shot ? (
            <>
              <Button type="button" variant="secondary" onClick={retake}>
                <RefreshCw aria-hidden="true" />
                Retake
              </Button>
              <Button type="button" onClick={usePhoto}>
                Use photo
              </Button>
            </>
          ) : (
            <>
              {cameras.length > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCameraIndex((i) => (i + 1) % cameras.length)}
                >
                  <SwitchCamera aria-hidden="true" />
                  Switch camera
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <Button type="button" onClick={takePhoto} disabled={starting || !!error}>
                <Camera aria-hidden="true" />
                Take photo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
