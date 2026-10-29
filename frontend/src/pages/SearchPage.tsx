import { SearchX, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState } from '@/components/common/States'
import { Container } from '@/components/layout/PageHeader'
import { DidYouMean } from '@/components/search/DidYouMean'
import { FilterPanel } from '@/components/search/FilterPanel'
import { countActiveFilters } from '@/lib/filters'
import { ResultsGrid, ResultsSkeleton } from '@/components/search/ResultsGrid'
import { SearchBar } from '@/components/search/SearchBar'
import { WhyLine } from '@/components/search/WhyLine'
import { ItemTag } from '@/components/tag/ItemTag'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useBrowseItems } from '@/hooks/useItems'
import { useSearch } from '@/hooks/useSearch'
import { plural } from '@/lib/format'
import { ITEM_STATUSES, type ItemFilters, type ItemStatus } from '@/lib/types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function readFilters(params: URLSearchParams): ItemFilters {
  const type = params.get('type')
  const category = params.get('category')
  const status = params.get('status')
  const location = Number(params.get('location_id'))
  const from = params.get('date_from') ?? ''
  const to = params.get('date_to') ?? ''
  return {
    type: type === 'LOST' || type === 'FOUND' ? type : undefined,
    // Any name up to 30 characters: students can add new kinds of items while reporting.
    category: category && category.trim().length >= 2 && category.length <= 30 ? category : undefined,
    status: status && (ITEM_STATUSES as readonly string[]).includes(status) ? (status as ItemStatus) : undefined,
    location_id: Number.isInteger(location) && location > 0 ? location : undefined,
    date_from: DATE_RE.test(from) ? from : undefined,
    date_to: DATE_RE.test(to) ? to : undefined,
  }
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const noCorrect = params.get('nocorrect') === '1'
  const filters = useMemo(() => readFilters(params), [params])
  const activeCount = countActiveFilters(filters)
  const [sheetOpen, setSheetOpen] = useState(false)
  useDocumentTitle(q ? `Results for ${q}` : 'Search')

  const updateParams = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next, { replace: false })
  }

  const onFilterChange = (patch: Partial<ItemFilters>) => updateParams(patch as Record<string, string | number | undefined>)

  const clearFilters = () => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    setParams(next)
  }

  const filterPanel = (prefix: string) => <FilterPanel filters={filters} onChange={onFilterChange} idPrefix={prefix} />

  return (
    <Container>
      <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
        {q ? 'Search results' : 'Browse items'}
      </h1>
      <div className="mt-4 max-w-2xl">
        <SearchBar
          key={q}
          defaultValue={q}
          autoFocus={!q && !activeCount}
          onSearch={(value) => updateParams({ q: value || undefined, nocorrect: undefined })}
        />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-24 rounded-panel border border-line bg-surface shadow-card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-ink">Filters</h2>
              {activeCount > 0 && (
                <Button variant="link" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>
            {filterPanel('desk')}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <Button variant="secondary" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              <SlidersHorizontal aria-hidden="true" />
              Filters
              {activeCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cobalt px-1.5 text-xs font-bold text-on-cobalt">
                  {activeCount}
                  <span className="sr-only"> active</span>
                </span>
              )}
            </Button>
            {activeCount > 0 && (
              <Button variant="link" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>

          {q ? (
            <SearchResults q={q} filters={filters} noCorrect={noCorrect} onClear={clearFilters} />
          ) : (
            <BrowseResults filters={filters} onClear={clearFilters} />
          )}
        </div>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              {activeCount ? `${plural(activeCount, 'filter')} on` : 'Narrow down what you see.'}
            </SheetDescription>
          </SheetHeader>
          {filterPanel('sheet')}
          <div className="sticky bottom-0 mt-6 flex gap-3 bg-surface pt-3">
            <Button variant="secondary" className="flex-1" onClick={clearFilters} disabled={!activeCount}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Dialog>
    </Container>
  )
}

function SearchResults({
  q,
  filters,
  noCorrect,
  onClear,
}: {
  q: string
  filters: ItemFilters
  noCorrect: boolean
  onClear: () => void
}) {
  const { data, isPending, isError, error, refetch, isFetching } = useSearch(q, filters)

  if (isError) return <ErrorState title="Search didn't finish" error={error} onRetry={() => void refetch()} />
  if (isPending) return <ResultsSkeleton />

  // In "search the original" mode a corrected response means the original had no hits.
  const corrected = data.corrected_query
  const hits = noCorrect && corrected ? [] : data.results
  const original = data.query || q
  const originalHref = `/search?${new URLSearchParams({ q: original, nocorrect: '1' }).toString()}`

  return (
    <div aria-busy={isFetching} className="flex flex-col gap-4">
      <p aria-live="polite" className="text-sm text-ink-soft">
        {hits.length
          ? `${plural(noCorrect ? hits.length : data.total, 'result')} for '${corrected && !noCorrect ? corrected : original}'`
          : `No results for '${original}'`}
      </p>
      {corrected && !noCorrect && hits.length > 0 && (
        <DidYouMean original={original} corrected={corrected} originalHref={originalHref} />
      )}
      {hits.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`No results for '${original}'`}
          actions={
            <>
              <Button asChild>
                <Link to="/report/lost">Report a lost item</Link>
              </Button>
              {countActiveFilters(filters) > 0 && (
                <Button variant="secondary" onClick={onClear}>
                  Clear filters
                </Button>
              )}
            </>
          }
        >
          Try a shorter or different word, or report it. We'll match it against every new found item and tell you.
        </EmptyState>
      ) : (
        <ResultsGrid>
          {hits.map((hit) => {
            const terms = hit.reasons.map((r) => r.matched_term)
            return (
              <li key={hit.item.id}>
                <ItemTag
                  item={hit.item}
                  highlight={terms}
                  showDescription
                  why={<WhyLine reasons={hit.reasons} />}
                  className="h-full"
                />
              </li>
            )
          })}
        </ResultsGrid>
      )}
    </div>
  )
}

function BrowseResults({ filters, onClear }: { filters: ItemFilters; onClear: () => void }) {
  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useBrowseItems(
    filters,
    true,
  )

  if (isError) return <ErrorState title="Items didn't load" error={error} onRetry={() => void refetch()} />
  if (isPending) return <ResultsSkeleton />

  const items = data.pages.flatMap((p) => p.items)
  const total = data.pages[0]?.total ?? 0
  const filtered = countActiveFilters(filters) > 0

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" className="text-sm text-ink-soft">
        {total ? `${plural(total, 'item')}, newest first` : 'No items'}
      </p>
      {items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={filtered ? 'Nothing matches these filters' : 'No items reported yet'}
          actions={
            filtered ? (
              <Button variant="secondary" onClick={onClear}>
                Clear filters
              </Button>
            ) : (
              <Button asChild>
                <Link to="/report/found">Report a found item</Link>
              </Button>
            )
          }
        >
          {filtered
            ? 'Try a wider date range or a different place.'
            : 'When someone reports a lost or found item it will show up here.'}
        </EmptyState>
      ) : (
        <>
          <ResultsGrid>
            {items.map((item) => (
              <li key={item.id}>
                <ItemTag item={item} showDescription className="h-full" />
              </li>
            ))}
          </ResultsGrid>
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
                Show more items
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
