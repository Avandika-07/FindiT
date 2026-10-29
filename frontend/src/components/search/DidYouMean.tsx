import { Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'

export function DidYouMean({
  original,
  corrected,
  originalHref,
}: {
  original: string
  corrected: string
  originalHref: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-panel border border-[color-mix(in_srgb,var(--signal)_55%,var(--line))] bg-[color-mix(in_srgb,var(--signal)_10%,var(--surface))] p-4">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-signal-text" aria-hidden="true" />
      <div className="text-sm text-ink">
        <p>
          No results for <strong className="font-semibold">'{original}'</strong>. Showing results for{' '}
          <strong className="font-semibold">'{corrected}'</strong>.
        </p>
        <Link
          to={originalHref}
          className="mt-1 inline-block font-semibold text-cobalt underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-cobalt"
        >
          Search for '{original}' instead
        </Link>
      </div>
    </div>
  )
}
