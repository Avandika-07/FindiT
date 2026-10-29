import { Camera, ImagePlus, Images, LoaderCircle, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { canUseLiveCamera, PHOTO_ACCEPT, PhotoError, prefersNativeCamera, preparePhoto } from '@/lib/image'
import { cn } from '@/lib/utils'
import { CameraCapture } from './CameraCapture'

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function rejectionMessage(rejection: FileRejection): string {
  const code = rejection.errors[0]?.code
  if (code === 'file-invalid-type') return 'Use a JPG, PNG or WebP photo.'
  if (code === 'too-many-files') return 'Choose one photo.'
  return rejection.errors[0]?.message ?? 'That file could not be used.'
}

/**
 * One photo upload with three ways in: take a photo with the camera, choose one from the
 * device, or drag it in. Phones open their own camera app; laptops get a live preview.
 * Photos over the size limit are shrunk in the browser instead of being rejected.
 */
export function PhotoDrop({
  file,
  onChange,
  maxMb,
  id,
  label = 'Add a photo',
  hint,
  compact,
}: {
  file: File | null
  onChange: (file: File | null) => void
  maxMb: number
  id: string
  label?: string
  hint?: string
  compact?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const nativeCameraRef = useRef<HTMLInputElement>(null)
  // Object URLs are tiny; we skip revoking so StrictMode remounts never break the preview.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  const accept = async (picked: File | undefined) => {
    if (!picked) return
    setError(null)
    setPreparing(true)
    try {
      onChange(await preparePhoto(picked, maxMb))
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : 'That photo could not be used. Try another one.')
    } finally {
      setPreparing(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT,
    multiple: false,
    noClick: !!file,
    noKeyboard: !!file,
    onDropAccepted: (files) => void accept(files[0]),
    onDropRejected: (rejections) => setError(rejectionMessage(rejections[0])),
  })

  const takePhoto = () => {
    setError(null)
    if (prefersNativeCamera() || !canUseLiveCamera()) nativeCameraRef.current?.click()
    else setCameraOpen(true)
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" className="h-11 sm:h-9" onClick={takePhoto} disabled={preparing}>
        <Camera aria-hidden="true" />
        {file ? 'Retake' : 'Take photo'}
      </Button>
      <Button type="button" variant="secondary" size="sm" className="h-11 sm:h-9" onClick={open} disabled={preparing}>
        <Images aria-hidden="true" />
        {file ? 'Replace' : 'Choose from device'}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Opens the phone's own camera app. Laptops without a live camera get a file picker. */}
      <input
        ref={nativeCameraRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void accept(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {file && preview ? (
        <div {...getRootProps({ className: 'flex flex-col gap-3 outline-none' })}>
          <input {...getInputProps({ id })} />
          <div className="relative overflow-hidden rounded-panel border border-line bg-wash">
            <img
              src={preview}
              alt="Selected photo preview"
              className={cn('w-full object-contain', compact ? 'max-h-48' : 'max-h-80')}
            />
          </div>
          <span className="min-w-0 truncate text-sm text-ink-soft">
            {file.name}, {formatSize(file.size)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <Button
              type="button"
              variant="outlineDanger"
              size="sm"
              className="h-11 sm:h-9"
              onClick={() => {
                setError(null)
                onChange(null)
              }}
            >
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div
            {...getRootProps({
              className: cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-panel border-2 border-dashed px-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt',
                compact ? 'py-6' : 'py-10 sm:py-12',
                isDragActive
                  ? 'border-cobalt bg-[color-mix(in_srgb,var(--cobalt)_8%,var(--surface))]'
                  : 'border-line-strong bg-surface hover:border-ink-soft',
              ),
              role: 'button',
              'aria-label': `${label}. Choose a JPG, PNG or WebP photo`,
            })}
          >
            <input {...getInputProps({ id })} />
            <span className="grid size-12 place-items-center rounded-full bg-wash text-ink-soft">
              {preparing ? (
                <LoaderCircle className="size-6 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="size-6" aria-hidden="true" />
              )}
            </span>
            <span>
              <span className="block font-semibold text-ink">
                {preparing ? 'Preparing your photo' : isDragActive ? 'Drop the photo here' : label}
              </span>
              <span className="mt-1 block text-sm text-ink-soft">
                {hint ?? 'Take a photo, choose one, or drag it here.'} JPG, PNG or WebP. Big photos are made smaller
                for you (up to {maxMb} MB).
              </span>
            </span>
          </div>
          {actions}
        </>
      )}
      {error && <FieldError>{error}</FieldError>}

      <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(shot) => void accept(shot)} />
    </div>
  )
}
