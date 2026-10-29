import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { TagMessage } from '@/components/common/TagMessage'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function ErrorPage() {
  const error = useRouteError()
  useDocumentTitle('Something broke')
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null

  return (
    <TagMessage
      title="This page came loose"
      tone="lost"
      actions={
        <>
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
          <Button asChild variant="secondary">
            <Link to="/">Back to home</Link>
          </Button>
        </>
      }
    >
      Something in the app broke while showing this screen. Reloading usually fixes it.
      {detail && <span className="mt-2 block text-sm">Details: {detail}</span>}
    </TagMessage>
  )
}
