/** Photo helpers shared by every upload: type check and in-browser shrinking. */

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',')

export class PhotoError extends Error {}

const MAX_SIDE = 2560

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      // Respects the EXIF orientation of phone photos.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fall back to an <img> below */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoError('That photo could not be processed.'))), 'image/jpeg', quality),
  )
}

function jpegName(name: string): string {
  return `${name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`
}

/**
 * Make a photo ready to upload: only JPG/PNG/WebP, and never over `maxMb`. Big phone
 * photos are scaled down (longest side 2560 px) and re-encoded as JPEG instead of rejected.
 */
export async function preparePhoto(file: File, maxMb: number): Promise<File> {
  if (!PHOTO_TYPES.includes(file.type as (typeof PHOTO_TYPES)[number])) {
    throw new PhotoError('Use a JPG, PNG or WebP photo.')
  }
  const limit = maxMb * 1024 * 1024
  if (file.size <= limit) return file

  let source
  try {
    source = await decode(file)
  } catch {
    throw new PhotoError('That photo could not be opened. Try another one.')
  }
  let scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height))
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await encode(canvas, attempt < 2 ? 0.85 : 0.75)
    if (blob.size <= limit) return new File([blob], jpegName(file.name), { type: 'image/jpeg' })
    scale *= 0.75
  }
  throw new PhotoError(`That photo is too large. Choose one under ${maxMb} MB.`)
}

/** Phones and tablets: their own camera app gives better photos than an in-page preview. */
export function prefersNativeCamera(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

/** Live camera preview needs a secure page (https, localhost or 127.0.0.1). */
export function canUseLiveCamera(): boolean {
  return !!navigator.mediaDevices?.getUserMedia && window.isSecureContext
}
