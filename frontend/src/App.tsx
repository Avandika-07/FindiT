import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { ThemeProvider, useTheme } from '@/hooks/useTheme'
import { onUnauthorized } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'

/** On any 401: drop the session and send the user to /login, keeping where they were. */
function UnauthorizedBridge() {
  const { clearSession } = useAuth()
  useEffect(() => {
    onUnauthorized(() => {
      clearSession()
      const { pathname, search } = window.location
      if (pathname === '/login') return
      void router.navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true })
    })
    return () => onUnauthorized(() => {})
  }, [clearSession])
  return null
}

function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      closeButton
      offset={{ top: 72 }}
      mobileOffset={{ top: 72 }}
      toastOptions={{
        classNames: {
          toast: '!rounded-panel !border-line !bg-surface !text-ink !font-sans !shadow-xl',
          description: '!text-ink-soft',
          success: '[&_[data-icon]]:!text-found-text',
          error: '[&_[data-icon]]:!text-danger',
        },
      }}
    />
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MotionConfig reducedMotion="user">
            <TooltipProvider>
              <UnauthorizedBridge />
              <RouterProvider router={router} future={{ v7_startTransition: true }} />
              <ThemedToaster />
            </TooltipProvider>
          </MotionConfig>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
