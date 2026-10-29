import { BellRing, Hand, KeyRound, PackageOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/common/States'
import { Container } from '@/components/layout/PageHeader'
import { ReportChoiceTile } from '@/components/layout/ReportChooser'
import { SearchBar } from '@/components/search/SearchBar'
import { CategoryIcon } from '@/components/tag/CategoryIcon'
import { ItemTag } from '@/components/tag/ItemTag'
import { TagSkeleton } from '@/components/tag/TagSkeleton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRecentItems, useStats } from '@/hooks/useItems'
import { useMeta } from '@/hooks/useMeta'
import { cn } from '@/lib/utils'

/** Category chips cycle through the tints; each pairs a tint with its AA text colour. */
const CHIP_TONES = [
  'bg-cobalt-tint text-cobalt-text',
  'bg-violet-tint text-violet-text',
  'bg-found-tint text-found-text',
  'bg-signal-tint text-signal-text',
  'bg-lost-tint text-lost-text',
]

/** Stat cards: cobalt tint, teal tint, and one dark ink card with a sunflower number. */
const STAT_TONES = [
  { card: 'border-[color-mix(in_srgb,var(--cobalt)_22%,var(--line))] bg-cobalt-tint', label: 'text-cobalt-text', value: 'text-ink' },
  { card: 'border-[color-mix(in_srgb,var(--found)_26%,var(--line))] bg-found-tint', label: 'text-found-text', value: 'text-ink' },
  { card: 'border-transparent bg-night', label: 'text-night-soft', value: 'text-signal' },
]

export default function HomePage() {
  useDocumentTitle()
  const { categories } = useMeta()

  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      <Container>
        <section
          aria-labelledby="hero-title"
          className="hero-mesh relative isolate rounded-[28px] px-5 pt-10 pb-8 text-center shadow-[0_24px_60px_-24px_rgb(59_91_255/0.55)] sm:px-10 sm:pt-14 sm:pb-12"
        >
          <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-[28px]">
            <span className="hero-tag top-6 -right-10 sm:top-10 sm:right-8" style={{ rotate: '14deg' }} />
            <span className="hero-tag -bottom-6 -left-12 sm:bottom-10 sm:left-6" style={{ rotate: '-12deg', animationDelay: '-3s' }} />
            <span className="hero-tag top-1/3 left-[8%] hidden scale-75 lg:block" style={{ rotate: '-6deg', animationDelay: '-6s' }} />
            <span className="hero-tag right-[12%] bottom-1/4 hidden scale-90 lg:block" style={{ rotate: '8deg', animationDelay: '-1.5s' }} />
          </div>
          <div className="mx-auto max-w-3xl">
            <h1
              id="hero-title"
              className="font-display text-[2.125rem] leading-[1.08] font-extrabold tracking-tight text-white sm:text-4xl lg:text-[3.5rem]"
            >
              Lost something on campus? Let's get it back.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-white">
              Search what's been handed in, or report it once and we'll match it for you.
            </p>
            <div className="mx-auto mt-8 max-w-2xl text-left">
              <SearchBar size="lg" />
            </div>
            <ul aria-label="Browse by category" className="mt-5 flex flex-wrap justify-center gap-2">
              {categories.slice(0, 10).map((c, i) => (
                <li key={c.name}>
                  <Link
                    to={`/search?category=${encodeURIComponent(c.name)}`}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_4px_14px_-6px_rgb(20_27_58/0.35)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:hover:translate-y-0',
                      CHIP_TONES[i % CHIP_TONES.length],
                    )}
                  >
                    <CategoryIcon category={c.name} className="size-4" />
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Container>

      <Container>
        <section aria-label="Report an item" className="grid gap-4 sm:grid-cols-2">
          <ReportChoiceTile kind="lost" size="lg" />
          <ReportChoiceTile kind="found" size="lg" />
        </section>
      </Container>

      <RecentlyFound />

      <Container>
        <HowItWorks />
      </Container>

      <Container>
        <StatsStrip />
      </Container>
    </div>
  )
}

function RecentlyFound() {
  const { data, isPending, isError, error, refetch } = useRecentItems({ type: 'FOUND' }, 10)
  const items = data?.items ?? []

  return (
    <section aria-labelledby="recent-title">
      <Container className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="recent-title" className="font-display text-2xl font-bold text-ink">
            Recently found
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Handed in by students around campus.</p>
        </div>
        <Button asChild variant="link">
          <Link to="/search?type=FOUND">See all found items</Link>
        </Button>
      </Container>

      {isError ? (
        <Container>
          <ErrorState title="Recently found items didn't load" error={error} onRetry={() => void refetch()} />
        </Container>
      ) : isPending ? (
        <div className="scrollbar-none flex gap-4 overflow-x-hidden px-4 pt-1 pb-6 sm:px-6 lg:px-[max(2rem,calc((100%_-_1200px)/2_+_2rem))]">
          {[0, 1, 2, 3].map((i) => (
            <TagSkeleton key={i} className="w-[300px] shrink-0" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Container>
          <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong p-6 sm:flex-row sm:items-center">
            <PackageOpen className="size-6 text-ink-soft" aria-hidden="true" />
            <p className="flex-1 text-ink-soft">Nothing has been handed in yet. Found something? Be the first.</p>
            <Button asChild variant="secondary">
              <Link to="/report/found">Report a found item</Link>
            </Button>
          </div>
        </Container>
      ) : (
        <ul
          className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-6 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2rem,calc((100%_-_1200px)/2_+_2rem))] lg:px-[max(2rem,calc((100%_-_1200px)/2_+_2rem))]"
          aria-label="Recently found items"
        >
          {items.map((item) => (
            <li key={item.id} className="w-[min(300px,82vw)] shrink-0 snap-start">
              <ItemTag item={item} compact className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const STEPS = [
  {
    icon: Hand,
    title: 'Report',
    body: 'Tell us what you lost or found, where and when. Add a photo if you have one.',
  },
  {
    icon: BellRing,
    title: 'Get matched',
    body: 'FindiT compares every new report and alerts you with a score and the reasons why.',
  },
  {
    icon: KeyRound,
    title: 'Collect with your code',
    body: 'Prove it is yours, get approved, then show your 6-digit handover code at the desk.',
  },
]

const STEP_TONES = ['bg-cobalt-tint text-cobalt-text', 'bg-violet-tint text-violet-text', 'bg-found-tint text-found-text']

function HowItWorks() {
  return (
    <section aria-labelledby="how-title">
      <h2 id="how-title" className="font-display text-2xl font-bold text-ink">
        How FindiT works
      </h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-full font-display text-lg font-extrabold',
                  STEP_TONES[i % STEP_TONES.length],
                )}
              >
                {i + 1}
              </span>
              <step.icon className="size-5 text-ink-soft" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-1.5 text-sm text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function StatsStrip() {
  const { data, isPending, isError } = useStats()
  if (isError) return null
  const avg = data?.avg_days_to_return
  const stats = [
    { label: 'Items returned this month', value: data ? String(data.returned_this_month) : null },
    {
      label: 'Average days to return',
      value: data ? (avg === null || avg === undefined ? 'None yet' : avg.toFixed(avg < 10 ? 1 : 0)) : null,
    },
    { label: 'Found items waiting for owners', value: data ? String(data.open_found) : null },
  ]
  return (
    <section aria-label="FindiT in numbers">
      <dl className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {stats.map((s, i) => {
          const tone = STAT_TONES[i % STAT_TONES.length]
          return (
            <div key={s.label} className={cn('flex flex-col gap-1 rounded-panel border p-5 shadow-card sm:p-6', tone.card)}>
              <dt className={cn('text-sm font-medium', tone.label)}>{s.label}</dt>
              <dd className={cn('font-display text-3xl font-extrabold', tone.value)}>
                {isPending ? <Skeleton className="h-9 w-16 bg-[color-mix(in_srgb,currentColor_18%,transparent)]" /> : s.value}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
