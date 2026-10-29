import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState } from '@/components/common/States'
import { Container, PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/layout/UserMenus'
import { SkeletonList } from '@/components/tag/TagSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function LeaderboardPage() {
  useDocumentTitle('Leaderboard')
  const { user, isLoggedIn } = useAuth()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['leaderboard', isLoggedIn],
    queryFn: api.leaderboard,
  })

  const meInTop = !!data && !!user && data.entries.some((e) => e.user.id === user.id)

  return (
    <Container className="max-w-[720px]">
      <PageHeader
        title="Leaderboard"
        description="Students who handed in the most items that made it home. Karma goes up every time something you found is returned."
      />
      {isError ? (
        <ErrorState title="The leaderboard didn't load" error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <SkeletonList count={6} kind="row" className="space-y-3" label="Loading the leaderboard" />
      ) : data.entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No finders yet"
          actions={
            <Button asChild>
              <Link to="/report/found">Report a found item</Link>
            </Button>
          }
        >
          Hand in something you found and you could be first on the board.
        </EmptyState>
      ) : (
        <>
          <ol className="flex flex-col gap-2" aria-label="Top finders">
            {data.entries.map((entry) => {
              const isMe = !!user && entry.user.id === user.id
              return (
                <li
                  key={entry.user.id}
                  aria-current={isMe ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-4 rounded-panel border bg-surface p-3 pr-5 sm:p-4 sm:pr-6',
                    isMe ? 'border-cobalt ring-1 ring-cobalt' : 'border-line',
                  )}
                >
                  <span
                    className={cn(
                      'w-10 shrink-0 text-center font-display font-extrabold tabular-nums',
                      entry.rank <= 3 ? 'text-2xl text-ink' : 'text-lg text-ink-soft',
                    )}
                  >
                    <span className="sr-only">Rank </span>
                    {entry.rank}
                  </span>
                  <Avatar name={entry.user.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-semibold text-ink">
                      {entry.user.display_name}
                      {isMe && <Badge tone="cobalt">You</Badge>}
                    </p>
                    <p className="text-sm text-ink-soft">{plural(entry.returns, 'item')} returned</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl leading-none font-extrabold text-ink tabular-nums">{entry.karma}</p>
                    <p className="mt-1 text-xs text-ink-soft">karma</p>
                  </div>
                </li>
              )
            })}
          </ol>
          {data.me && !meInTop && (
            <div className="mt-6 flex items-center gap-4 rounded-panel border border-cobalt bg-surface p-4 pr-6">
              <span className="w-10 text-center font-display text-lg font-extrabold text-ink tabular-nums">
                <span className="sr-only">Your rank </span>
                {data.me.rank ?? '–'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{data.me.rank === null ? 'Not ranked yet' : 'Your position'}</p>
                <p className="text-sm text-ink-soft">
                  {data.me.rank === null
                    ? 'Hand in a found item that gets returned to earn your first karma.'
                    : `${plural(data.me.returns, 'item')} returned`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl leading-none font-extrabold text-ink tabular-nums">{data.me.karma}</p>
                <p className="mt-1 text-xs text-ink-soft">karma</p>
              </div>
            </div>
          )}
        </>
      )}
    </Container>
  )
}
