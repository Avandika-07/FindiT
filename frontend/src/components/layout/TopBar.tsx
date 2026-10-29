import { Hand, LogIn, Plus, Search } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SearchBar } from '@/components/search/SearchBar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { NotificationsBell } from './NotificationsBell'
import { Container } from './PageHeader'
import { useLoginHref } from '@/hooks/useLoginHref'
import { ThemeMenu, UserMenu } from './UserMenus'
import { Wordmark } from './Wordmark'

export function TopBar() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const loginHref = useLoginHref()
  const onSearchPage = location.pathname === '/search'
  const onHome = location.pathname === '/'

  return (
    <header className="sticky top-0 z-40 glass border-b border-line pt-[env(safe-area-inset-top)]">
      <Container className="flex h-16 items-center gap-4">
        <Wordmark />

        <div className="hidden max-w-md flex-1 md:block">
          {!onSearchPage && !onHome && <SearchBar size="sm" />}
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus aria-hidden="true" />
                  Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={() => navigate('/report/lost')}>
                  <Search aria-hidden="true" className="!text-lost-text" />
                  I lost something
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/report/found')}>
                  <Hand aria-hidden="true" className="!text-found-text" />
                  I found something
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isLoggedIn ? (
            <>
              <NotificationsBell />
              <div className="hidden md:block">
                <UserMenu />
              </div>
            </>
          ) : (
            <>
              <div className="hidden md:block">
                <ThemeMenu />
              </div>
              <Button asChild variant="secondary" className="hidden md:inline-flex">
                <Link to={loginHref}>
                  <LogIn aria-hidden="true" />
                  Log in
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-11 md:hidden">
                <Link to={loginHref}>Log in</Link>
              </Button>
            </>
          )}
        </div>
      </Container>
    </header>
  )
}
