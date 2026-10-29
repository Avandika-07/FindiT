import { LogIn, LogOut, Monitor, Moon, Package, ShieldCheck, Sun, Trophy } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Segmented } from '@/components/ui/segmented'
import { SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/hooks/useAuth'
import { useLoginHref } from '@/hooks/useLoginHref'
import { useTheme, type ThemePreference } from '@/hooks/useTheme'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--cobalt)_16%,var(--surface))] font-display text-sm font-bold text-cobalt',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

function useLogout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return async () => {
    await logout()
    toast.success('Logged out')
    navigate('/')
  }
}

export function UserMenu() {
  const { user, isAdmin } = useAuth()
  const { preference, setPreference } = useTheme()
  const navigate = useNavigate()
  const logout = useLogout()
  const name = user?.display_name ?? 'You'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          <Avatar name={user?.full_name || name} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar name={user?.full_name || name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{user?.full_name || name}</span>
            <span className="block truncate text-xs text-ink-soft">{user?.roll_no}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/me')}>
          <Package aria-hidden="true" />
          My stuff
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/leaderboard')}>
          <Trophy aria-hidden="true" />
          Leaderboard
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onSelect={() => navigate('/admin')}>
            <ShieldCheck aria-hidden="true" />
            Admin desk
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="pb-1 text-xs text-ink-soft">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden="true" />
            System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ThemeMenu() {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          {resolved === 'dark' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden="true" />
            System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Mobile "You" tab: account, links, theme, log in/out. */
export function ProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, isLoggedIn, isAdmin } = useAuth()
  const { preference, setPreference } = useTheme()
  const logout = useLogout()
  const loginHref = useLoginHref()
  const close = () => onOpenChange(false)

  const linkClass =
    'flex min-h-12 items-center gap-3 rounded-control px-3 text-base font-medium text-ink hover:bg-wash focus-visible:outline-2 focus-visible:outline-cobalt [&_svg]:size-5 [&_svg]:text-ink-soft'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {isLoggedIn && user ? (
          <div className="mb-4 flex items-center gap-3 pr-10">
            <Avatar name={user.full_name || user.display_name} className="size-12 text-base" />
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg">{user.full_name || user.display_name}</SheetTitle>
              <SheetDescription>
                {user.roll_no}
                <span className="sr-only">.</span>
              </SheetDescription>
            </div>
          </div>
        ) : (
          <div className="mb-4 pr-10">
            <SheetTitle>You're browsing as a guest</SheetTitle>
            <SheetDescription>Log in to report items, claim them and get match alerts.</SheetDescription>
          </div>
        )}

        {isLoggedIn && user && (
          <dl className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-panel border border-line p-3">
              <dt className="text-xs text-ink-soft">Karma</dt>
              <dd className="font-display text-2xl font-extrabold text-ink">{user.karma}</dd>
            </div>
            <div className="rounded-panel border border-line p-3">
              <dt className="text-xs text-ink-soft">Items returned</dt>
              <dd className="font-display text-2xl font-extrabold text-ink">{user.returns_count}</dd>
            </div>
          </dl>
        )}

        <nav aria-label="Account" className="flex flex-col">
          {isLoggedIn && (
            <Link to="/me" className={linkClass} onClick={close}>
              <Package aria-hidden="true" />
              My stuff
            </Link>
          )}
          <Link to="/leaderboard" className={linkClass} onClick={close}>
            <Trophy aria-hidden="true" />
            Leaderboard
          </Link>
          {isAdmin && (
            <Link to="/admin" className={linkClass} onClick={close}>
              <ShieldCheck aria-hidden="true" />
              Admin desk
            </Link>
          )}
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          <p id="theme-label" className="mb-2 text-sm font-semibold text-ink">
            Theme
          </p>
          <Segmented value={preference} onValueChange={setPreference} options={THEME_OPTIONS} label="Theme" />
        </div>

        <div className="mt-5">
          {isLoggedIn ? (
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                close()
                void logout()
              }}
            >
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link to={loginHref} onClick={close}>
                <LogIn aria-hidden="true" />
                Log in
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Dialog>
  )
}
