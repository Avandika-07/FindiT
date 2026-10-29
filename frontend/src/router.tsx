import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from '@/components/common/Guards'
import { AppShell } from '@/components/layout/AppShell'
import { Container } from '@/components/layout/PageHeader'
import { SkeletonList } from '@/components/tag/TagSkeleton'
import ErrorPage from '@/pages/ErrorPage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'

/** Route-level code splitting: each page loads on first visit. */
function page(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default })
}

// Recharts lives only on the admin desk, so keep it out of the main bundle.
const AdminPage = lazy(() => import('@/pages/AdminPage'))

function AdminRoute() {
  return (
    <RequireAdmin>
      <Suspense
        fallback={
          <Container>
            <SkeletonList count={4} kind="row" className="space-y-3" label="Loading the admin desk" />
          </Container>
        }
      >
        <AdminPage />
      </Suspense>
    </RequireAdmin>
  )
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      {
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'search', lazy: page(() => import('@/pages/SearchPage')) },
          { path: 'items/:id', lazy: page(() => import('@/pages/ItemPage')) },
          { path: 'leaderboard', lazy: page(() => import('@/pages/LeaderboardPage')) },
          { path: 'login', lazy: page(() => import('@/pages/LoginPage')) },
          {
            element: <RequireAuth />,
            children: [
              {
                path: 'report/lost',
                lazy: async () => {
                  const { default: ReportPage } = await import('@/pages/ReportPage')
                  return { element: <ReportPage key="lost" type="LOST" /> }
                },
              },
              {
                path: 'report/found',
                lazy: async () => {
                  const { default: ReportPage } = await import('@/pages/ReportPage')
                  return { element: <ReportPage key="found" type="FOUND" /> }
                },
              },
              { path: 'report/done/:id', lazy: page(() => import('@/pages/ReportDonePage')) },
              { path: 'me', lazy: page(() => import('@/pages/MePage')) },
              { path: 'admin', element: <AdminRoute /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_skipActionErrorRevalidation: true,
  },
})
