import { differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import { env } from './env'
import type { ClaimStatus, Guidance, ItemStatus, ItemType, MatchReason } from './types'

/* ---------- Labels ---------- */

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  OPEN: 'Open',
  MATCHED: 'Matched',
  CLAIM_PENDING: 'Claim pending',
  RETURNED: 'Returned',
  EXPIRED: 'Expired',
  CLOSED: 'Closed',
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  PENDING: 'Under review',
  VERIFIED: 'Approved',
  REJECTED: 'Rejected',
  HANDED_OVER: 'Collected',
}

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  LOST: 'Lost',
  FOUND: 'Found',
}

export const GUIDANCE_LABEL: Record<Guidance, string> = {
  STRONG: 'Strong',
  WEAK: 'Weak',
  CHECK_CAREFULLY: 'Check carefully',
}

/** Timeline statuses can be item or claim statuses, or anything new the server adds. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Reported'
  if (status in ITEM_STATUS_LABEL) return ITEM_STATUS_LABEL[status as ItemStatus]
  if (status in CLAIM_STATUS_LABEL) return CLAIM_STATUS_LABEL[status as ClaimStatus]
  const words = status.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function isItemStatus(value: string): value is ItemStatus {
  return value in ITEM_STATUS_LABEL
}

export function isClaimStatus(value: string): value is ClaimStatus {
  return value in CLAIM_STATUS_LABEL
}

/* ---------- Dates ---------- */

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return format(d, 'yyyy-MM-dd')
}

function parse(value: string): Date | null {
  const d = parseISO(value)
  return isValid(d) ? d : null
}

/** "Today", "Yesterday", "Mon 6 Oct", or "6 Oct 2025" for older years. */
export function formatEventDate(value: string): string {
  const d = parse(value)
  if (!d) return value
  const diff = differenceInCalendarDays(new Date(), d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return format(d, 'EEEE')
  if (d.getFullYear() === new Date().getFullYear()) return format(d, 'd MMM')
  return format(d, 'd MMM yyyy')
}

/** For sentences: "today", "yesterday", "on Monday", "on 6 Oct". */
export function eventPhrase(value: string): string {
  const label = formatEventDate(value)
  if (label === 'Today' || label === 'Yesterday') return label.toLowerCase()
  return `on ${label}`
}

export function formatDateLong(value: string): string {
  const d = parse(value)
  return d ? format(d, 'd MMMM yyyy') : value
}

export function formatDateTime(value: string): string {
  const d = parse(value)
  return d ? format(d, "d MMM yyyy, h:mm aaaa") : value
}

export function formatRelative(value: string): string {
  const d = parse(value)
  if (!d) return value
  const seconds = (Date.now() - d.getTime()) / 1000
  if (seconds < 60) return 'Just now'
  return `${formatDistanceToNowStrict(d)} ago`
}

/* ---------- Media ---------- */

/** Prefix the media base only when the path is relative (not absolute, protocol-relative or rooted). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(https?:|data:|blob:)/i.test(path) || path.startsWith('//') || path.startsWith('/')) return path
  return `${env.mediaBaseUrl}/${path.replace(/^\.?\/*/, '')}`
}

/* ---------- Search explanations ---------- */

export function explainReason(reason: MatchReason): string {
  const q = reason.query_term
  const m = reason.matched_term
  switch (reason.method) {
    case 'sounds_like':
      return `${q} sounds like ${m}`
    case 'synonym':
      return `${q} means ${m}`
    case 'typo':
      return `${q} looks like ${m}`
    case 'prefix':
      return `${q} is the start of ${m}`
    case 'exact':
    default:
      return `Matches ${m}`
  }
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}
