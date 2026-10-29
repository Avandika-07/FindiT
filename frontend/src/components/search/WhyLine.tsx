import { Sparkles } from 'lucide-react'
import type { MatchReason } from '@/lib/types'

const VERB: Record<MatchReason['method'], string> = {
  exact: 'matches',
  synonym: 'means',
  sounds_like: 'sounds like',
  typo: 'looks like',
  prefix: 'is the start of',
}

/** "earfone sounds like earphones", "calci means calculator", "walelt looks like wallet". */
export function WhyLine({ reasons }: { reasons: MatchReason[] }) {
  const seen = new Set<string>()
  const unique = reasons.filter((r) => {
    const key = `${r.query_term}|${r.matched_term}|${r.method}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // Fuzzy explanations are the interesting ones; plain exact hits only show when nothing else does.
  const fuzzy = unique.filter((r) => r.method !== 'exact')
  const shown = (fuzzy.length ? fuzzy : unique).slice(0, 3)
  if (!shown.length) return null

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Why this result matched">
      {shown.map((r) => (
        <li key={`${r.query_term}-${r.matched_term}-${r.method}`} className="flex items-center gap-1.5 text-xs text-ink-soft">
          <Sparkles className="size-3.5 shrink-0 text-signal-text" aria-hidden="true" />
          {r.method === 'exact' ? (
            <span>
              Matches <strong className="font-semibold text-ink">{r.matched_term}</strong>
            </span>
          ) : (
            <span>
              <em className="not-italic font-medium text-ink">{r.query_term}</em> {VERB[r.method]}{' '}
              <strong className="font-semibold text-ink">{r.matched_term}</strong>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
