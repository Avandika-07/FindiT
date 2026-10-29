import { env } from './env'
import type {
  AdminStats,
  AIReview,
  ApiErrorBody,
  Claim,
  ClaimCreate,
  DemoUser,
  DuplicatesResponse,
  HotspotsResponse,
  Item,
  ItemAIReviews,
  ItemCreate,
  ItemFilters,
  ItemPage,
  ItemUpdate,
  LeaderboardResponse,
  Location,
  LoginResponse,
  Match,
  Me,
  Meta,
  NotificationsResponse,
  PublicStats,
  QueueEntry,
  SearchResponse,
  SuggestResponse,
  TimelineEntry,
} from './types'

/* ---------- Token storage ---------- */

const TOKEN_KEY = 'findit:token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: token lives only for this page */
  }
}

let unauthorizedHandler: (() => void) | null = null

/** Called whenever the API answers 401 on a request that carried a token or needed one. */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

/* ---------- Errors ---------- */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields ?? {}
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Try again.'
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object') return false
  const err = (value as { error?: unknown }).error
  return !!err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session has ended. Log in again to continue.'
  if (status === 403) return 'You are not allowed to do that with this account.'
  if (status === 404) return 'We could not find that. It may have been removed.'
  if (status === 413) return `That file is too large. Choose one under ${env.maxUploadMb} MB.`
  if (status === 423 || status === 429) return 'Too many wrong attempts. This code is locked for now.'
  if (status >= 500) return `The FindiT server ran into a problem (error ${status}). Try again in a moment.`
  return `The request failed (error ${status}).`
}

/* ---------- Core request ---------- */

type Query = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Query
  json?: unknown
  form?: FormData
  /** Skip the 401 → login redirect (used by the login call itself). */
  noAuthRedirect?: boolean
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Query): string {
  let url = `${env.apiBaseUrl}${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }
  return url
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, json, form, noAuthRedirect, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (form) {
    body = form
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), { method, headers, body, signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(
      0,
      'network_error',
      "Can't reach the FindiT server. Check your connection or that the server is running, then try again.",
    )
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = undefined
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !noAuthRedirect && (token || method !== 'GET')) {
      setToken(null)
      unauthorizedHandler?.()
    }
    if (isErrorBody(data)) {
      throw new ApiError(response.status, data.error.code, data.error.message, data.error.fields)
    }
    throw new ApiError(response.status, 'http_error', fallbackMessage(response.status))
  }

  if (data === undefined) {
    throw new ApiError(
      response.status,
      'bad_response',
      'The server sent a response FindiT could not read. Check that the API server is running.',
    )
  }
  return data as T
}

/* ---------- Endpoints ---------- */

export const api = {
  // auth
  login: (roll_no: string, password: string) =>
    request<LoginResponse>('/ext/auth/login', {
      method: 'POST',
      json: { roll_no, password },
      noAuthRedirect: true,
    }),
  logout: () => request<void>('/ext/auth/logout', { method: 'POST', noAuthRedirect: true }),
  // A stale token is handled by AuthProvider (signs out quietly), not by redirecting to /login.
  me: () => request<Me>('/ext/auth/me', { noAuthRedirect: true }),
  demoUsers: () => request<DemoUser[]>('/ext/auth/demo-users', { noAuthRedirect: true }),

  // meta
  meta: () => request<Meta>('/ext/meta'),
  locations: () => request<Location[]>('/locations'),
  stats: () => request<PublicStats>('/ext/stats'),
  leaderboard: () => request<LeaderboardResponse>('/ext/leaderboard'),

  // items
  listItems: (filters: ItemFilters & { page?: number; page_size?: number }) =>
    request<ItemPage>('/items', { query: { ...filters } }),
  getItem: (id: number) => request<Item>(`/items/${id}`),
  createItem: (payload: ItemCreate) => request<Item>('/items', { method: 'POST', json: payload }),
  updateItem: (id: number, payload: ItemUpdate) =>
    request<Item>(`/items/${id}`, { method: 'PATCH', json: payload }),
  uploadItemPhoto: (id: number, file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return request<Item>(`/items/${id}/photo`, { method: 'POST', form })
  },
  itemMatches: (id: number) => request<Match[]>(`/items/${id}/matches`),
  itemAiReviews: (id: number) => request<ItemAIReviews>(`/ext/items/${id}/ai-reviews`),
  rerunAiReview: (matchId: number) => request<AIReview>(`/ext/matches/${matchId}/ai-review`, { method: 'POST' }),
  itemTimeline: (id: number) => request<TimelineEntry[]>(`/ext/items/${id}/timeline`),
  checkDuplicates: (payload: Partial<ItemCreate> & Pick<ItemCreate, 'type' | 'title' | 'category'>) =>
    request<DuplicatesResponse>('/ext/items/check-duplicates', { method: 'POST', json: payload }),
  myItems: () => request<Item[]>('/ext/me/items'),

  // search
  search: (params: ItemFilters & { q: string; limit?: number }, signal?: AbortSignal) =>
    request<SearchResponse>('/search', { query: { ...params }, signal }),
  suggest: (prefix: string, signal?: AbortSignal) =>
    request<SuggestResponse>('/ext/search/suggest', { query: { prefix, limit: 8 }, signal }),

  // claims
  itemClaims: (itemId: number) => request<Claim[]>(`/items/${itemId}/claims`),
  createClaim: (itemId: number, payload: ClaimCreate) =>
    request<Claim>(`/items/${itemId}/claims`, { method: 'POST', json: payload }),
  uploadProofPhoto: (claimId: number, file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return request<Claim>(`/ext/claims/${claimId}/proof-photo`, { method: 'POST', form })
  },
  verifyClaim: (claimId: number, note: string) =>
    request<Claim>(`/claims/${claimId}/verify`, { method: 'POST', json: { note } }),
  rejectClaim: (claimId: number, note: string) =>
    request<Claim>(`/claims/${claimId}/reject`, { method: 'POST', json: { note } }),
  handover: (claimId: number, code: string) =>
    request<Claim>(`/claims/${claimId}/handover`, { method: 'POST', json: { code } }),
  myClaims: () => request<Claim[]>('/ext/me/claims'),

  // notifications
  notifications: () => request<NotificationsResponse>('/ext/notifications'),
  readAllNotifications: () => request<void>('/ext/notifications/read-all', { method: 'POST' }),
  readNotification: (id: number) => request<void>(`/ext/notifications/${id}/read`, { method: 'POST' }),

  // admin
  adminQueue: () => request<QueueEntry[]>('/ext/admin/queue'),
  adminVerified: () => request<QueueEntry[]>('/ext/admin/verified'),
  adminStats: () => request<AdminStats>('/ext/admin/stats'),
  adminHotspots: () => request<HotspotsResponse>('/ext/admin/hotspots'),
  adminFlagged: () => request<Me[]>('/ext/admin/flagged'),
  adminExpired: () => request<Item[]>('/ext/admin/expired'),
}
