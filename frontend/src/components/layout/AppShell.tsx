import { Outlet, ScrollRestoration } from 'react-router-dom'
import { env } from '@/lib/env'
import { BottomNav } from './BottomNav'
import { Container } from './PageHeader'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="app-blobs" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-cobalt px-4 py-3 font-semibold text-on-cobalt focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <TopBar />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 pt-6 pb-[calc(var(--nav-h)+env(safe-area-inset-bottom)+2rem)] outline-none sm:pt-8 md:pb-16"
      >
        <Outlet />
      </main>
      <footer className="glass hidden border-t border-line py-6 md:block">
        <Container className="flex items-center justify-between text-sm text-ink-soft">
          <p>{env.appName}, the campus lost and found.</p>
          <p>Every item tracked until it's home.</p>
        </Container>
      </footer>
      <BottomNav />
      <ScrollRestoration />
    </div>
  )
}
