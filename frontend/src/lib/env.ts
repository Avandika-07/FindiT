function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

function trimTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/+$/, '') : value
}

const maxMb = Number.parseFloat(clean(import.meta.env.VITE_MAX_UPLOAD_MB))

export const env = {
  appName: clean(import.meta.env.VITE_APP_NAME) || 'FindiT',
  apiBaseUrl: trimTrailingSlash(clean(import.meta.env.VITE_API_BASE_URL) || '/api'),
  mediaBaseUrl: trimTrailingSlash(clean(import.meta.env.VITE_MEDIA_BASE_URL) || '/media'),
  maxUploadMb: Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 5,
} as const
