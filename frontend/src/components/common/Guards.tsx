import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Container } from '@/components/layout/PageHeader'
import { SkeletonList } from '@/components/tag/TagSkeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState } from './States'

export function RequireAuth() {
  const { isLoggedIn } = useAuth()
  const location = useLocation()
  if (!isLoggedIn) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading, user } = useAuth()
  if (isLoading && !user) {
    return (
      <Container>
        <SkeletonList count={3} kind="row" className="space-y-3" label="Checking your access" />
      </Container>
    )
  }
  if (!isAdmin) {
    return (
      <Container className="max-w-[720px]">
        <EmptyState
          icon={ShieldAlert}
          title="This desk is for admins"
          actions={
            <Button asChild>
              <Link to="/">Back to home</Link>
            </Button>
          }
        >
          Your account can report and claim items, but reviewing claims and handovers needs an admin login.
        </EmptyState>
      </Container>
    )
  }
  return <>{children}</>
}
