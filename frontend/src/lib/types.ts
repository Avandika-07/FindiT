/**
 * Hand-written types matching openapi.yaml (components/schemas) and backend/EXT_API.md.
 * Enum values are case-sensitive and must stay identical to the contract.
 */

/* ---------- openapi.yaml ---------- */

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

export type ItemType = 'LOST' | 'FOUND'
export const ITEM_TYPES: readonly ItemType[] = ['LOST', 'FOUND']

export type ItemStatus = 'OPEN' | 'MATCHED' | 'CLAIM_PENDING' | 'RETURNED' | 'EXPIRED' | 'CLOSED'
export const ITEM_STATUSES: readonly ItemStatus[] = [
  'OPEN',
  'MATCHED',
  'CLAIM_PENDING',
  'RETURNED',
  'EXPIRED',
  'CLOSED',
]

export type ClaimStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'HANDED_OVER'

export type BuiltInCategory =
  | 'Phone'
  | 'Earphones'
  | 'Wallet'
  | 'ID card'
  | 'Keys'
  | 'Bag'
  | 'Bottle'
  | 'Laptop'
  | 'Charger'
  | 'Watch'
  | 'Spectacles'
  | 'Calculator'
  | 'Books and notes'
  | 'Umbrella'
  | 'Jewellery'
  | 'Clothing'
  | 'Other'

/** A built-in category or a kind of item a student added while reporting (listed by GET /ext/meta). */
export type Category = string

export const CATEGORIES: readonly BuiltInCategory[] = [
  'Phone',
  'Earphones',
  'Wallet',
  'ID card',
  'Keys',
  'Bag',
  'Bottle',
  'Laptop',
  'Charger',
  'Watch',
  'Spectacles',
  'Calculator',
  'Books and notes',
  'Umbrella',
  'Jewellery',
  'Clothing',
  'Other',
]

export interface LocationRef {
  id: number
  name: string
  zone: string
}

export interface Location {
  id: number
  name: string
  zone: string
  neighbor_ids: number[]
}

export interface UserRef {
  id: number
  /** First name only */
  display_name: string
}

export interface Item {
  id: number
  type: ItemType
  title: string
  description: string
  category: Category
  color: string | null
  brand: string | null
  location: LocationRef
  /** YYYY-MM-DD */
  event_date: string
  photo_url: string | null
  photo_blurred: boolean
  secret_question: string | null
  status: ItemStatus
  reporter: UserRef
  created_at: string
  updated_at: string
}

export interface ItemPage {
  items: Item[]
  total: number
  page: number
  page_size: number
}

interface ItemCreateBase {
  title: string
  description?: string
  category: Category
  color?: string | null
  brand?: string | null
  location_id: number
  event_date: string
}

export interface LostItemCreate extends ItemCreateBase {
  type: 'LOST'
}

export interface FoundItemCreate extends ItemCreateBase {
  type: 'FOUND'
  secret_question: string
  secret_answer: string
}

export type ItemCreate = LostItemCreate | FoundItemCreate

export interface ItemUpdate {
  title?: string
  description?: string
  color?: string | null
  brand?: string | null
  location_id?: number
  event_date?: string
  status?: 'CLOSED'
}

export interface MatchBreakdown {
  category: number
  text: number
  color: number
  brand: number
  location: number
  time: number
}

export interface Match {
  id: number
  score: number
  breakdown: MatchBreakdown
  reasons: string[]
  item: Item
  created_at: string
}

/** The local AI model's second opinion on a match (GET /ext/items/{id}/ai-reviews). */
export type AIReviewStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export interface AIReview {
  match_id: number
  status: AIReviewStatus
  match: boolean | null
  score: number | null
  confidence: 'high' | 'medium' | 'low' | null
  reason: string | null
  matching_features: string[]
  conflicting_features: string[]
  model: string | null
  error: string | null
  seconds: number | null
  updated_at: string
}

export interface ItemAIReviews {
  enabled: boolean
  model: string | null
  reviews: AIReview[]
}

export type MatchMethod = 'exact' | 'synonym' | 'prefix' | 'sounds_like' | 'typo'

export interface MatchReason {
  query_term: string
  matched_term: string
  method: MatchMethod
}

export interface SearchHit {
  item: Item
  score: number
  reasons: MatchReason[]
}

export interface SearchResponse {
  query: string
  corrected_query: string | null
  total: number
  results: SearchHit[]
}

export interface Claim {
  id: number
  item: Item
  claimant: UserRef
  proof_text: string
  proof_photo_url: string | null
  answer_score: number | null
  photo_similarity: number | null
  status: ClaimStatus
  decision_note: string | null
  handover_code: string | null
  created_at: string
  updated_at: string
}

export interface ClaimCreate {
  proof_text: string
  secret_answer: string
}

export interface ClaimDecision {
  note: string
}

export interface HandoverRequest {
  code: string
}

export interface ItemFilters {
  type?: ItemType
  category?: Category
  status?: ItemStatus
  location_id?: number
  date_from?: string
  date_to?: string
}

/* ---------- EXT_API.md ---------- */

export type Role = 'STUDENT' | 'ADMIN'

export interface Me {
  id: number
  roll_no: string
  email: string
  display_name: string
  full_name: string
  role: Role
  karma: number
  rejected_claims: number
  is_flagged: boolean
  returns_count: number
}

export interface LoginResponse {
  token: string
  expires_at: string
  user: Me
}

export interface DemoUser {
  roll_no: string
  password: string
  display_name: string
  role: Role
  label: string
}

export type NotificationKind =
  | 'MATCH'
  | 'CLAIM_NEW'
  | 'CLAIM_VERIFIED'
  | 'CLAIM_REJECTED'
  | 'RETURNED'
  | 'SYSTEM'

export interface AppNotification {
  id: number
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

export interface NotificationsResponse {
  unread: number
  items: AppNotification[]
}

export interface TimelineEntry {
  id: number
  from_status: string | null
  to_status: string
  note: string
  actor: UserRef | null
  at: string
}

export interface MetaCategory {
  name: Category
  icon: string
}

export interface MetaColor {
  name: string
  hex: string
}

export interface MetaZone {
  zone: string
  locations: LocationRef[]
}

export interface Meta {
  app_name: string
  categories: MetaCategory[]
  colors: MetaColor[]
  zones: MetaZone[]
  max_upload_mb: number
  handover_code_length: number
  item_expiry_days: number
  debug: boolean
  ai_enabled: boolean
  ai_model: string | null
}

export interface DuplicateHit {
  item: Item
  score: number
}

export interface DuplicatesResponse {
  duplicates: DuplicateHit[]
}

export interface SuggestResponse {
  suggestions: string[]
}

export interface PublicStats {
  returned_this_month: number
  avg_days_to_return: number | null
  open_found: number
  total_returned: number
}

export interface LeaderboardEntry {
  rank: number
  user: UserRef
  karma: number
  returns: number
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  /** rank is null while the user has no karma yet */
  me: { rank: number | null; karma: number; returns: number } | null
}

export type Guidance = 'STRONG' | 'WEAK' | 'CHECK_CAREFULLY'

export interface QueueEntry {
  claim: Claim
  secret_question: string | null
  claimant: Me
  guidance: Guidance
  guidance_reasons: string[]
  /** AI opinion on the claimant's own lost report vs this found item, if they reported it. */
  ai_review: AIReview | null
}

export interface AdminStats {
  open_lost: number
  open_found: number
  pending_claims: number
  verified_claims: number
  returned_this_week: number
  returned_this_month: number
  avg_days_to_return: number | null
  by_category: { category: string; lost: number; found: number }[]
  last_14_days: { date: string; lost: number; found: number; returned: number }[]
}

export interface HotspotLocation {
  id: number
  name: string
  lost_count: number
  found_count: number
}

export interface HotspotsResponse {
  zones: { zone: string; locations: HotspotLocation[] }[]
  top: (HotspotLocation & { zone: string })[]
  /** Reports per zone by weekday of the event date, Monday first (7 entries each). */
  by_weekday: { zone: string; lost: number[]; found: number[] }[]
}
