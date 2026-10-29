import { Link } from 'react-router-dom'
import { TagMessage } from '@/components/common/TagMessage'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <TagMessage
      code="404"
      title="This tag has no item attached"
      actions={
        <>
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/search">Search items</Link>
          </Button>
        </>
      }
    >
      The page you followed doesn't exist or has moved. Check the address, or start again from home.
    </TagMessage>
  )
}
