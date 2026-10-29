import { House, Package, Plus, Search, UserRound, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ReportChooser } from './ReportChooser'
import { ProfileSheet } from './UserMenus'

const tabClass = (active: boolean) =>
  cn(
    'flex h-full min-h-11 flex-col items-center justify-center gap-0.5 rounded-control text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cobalt',
    active ? 'text-cobalt' : 'text-ink-soft hover:text-ink',
  )

function Tab({ to, icon: Icon, label, end }: { to: string; icon: LucideIcon; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => tabClass(isActive)}>
      {({ isActive }) => (
        <>
          <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
          {label}
        </>
      )}
    </NavLink>
  )
}

export function BottomNav() {
  const [reportOpen, setReportOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 glass border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5 items-stretch px-2">
          <Tab to="/" icon={House} label="Home" end />
          <Tab to="/search" icon={Search} label="Search" />
          <div className="relative flex items-start justify-center">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              aria-haspopup="dialog"
              className="absolute -top-5 flex flex-col items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
            >
              <span className="grid size-14 place-items-center rounded-full bg-cobalt text-on-cobalt shadow-[0_10px_24px_-6px_color-mix(in_srgb,var(--cobalt)_75%,transparent)] ring-4 ring-surface transition-transform active:scale-95">
                <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-ink">Report</span>
            </button>
          </div>
          <Tab to="/me" icon={Package} label="My stuff" />
          <button type="button" onClick={() => setProfileOpen(true)} className={tabClass(profileOpen)} aria-haspopup="dialog">
            <UserRound className="size-[22px]" aria-hidden="true" />
            You
          </button>
        </div>
      </nav>
      <ReportChooser open={reportOpen} onOpenChange={setReportOpen} />
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  )
}
