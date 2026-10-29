import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ClaimQueue } from '@/components/admin/ClaimQueue'
import { FlaggedExpired } from '@/components/admin/FlaggedExpired'
import { HandoverDesk } from '@/components/admin/HandoverDesk'
import { HotspotGrid } from '@/components/admin/HotspotGrid'
import { StatsCards } from '@/components/admin/StatsCards'
import { Container, PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { api } from '@/lib/api'

const TABS = ['overview', 'queue', 'handover', 'hotspots', 'flagged'] as const
type Tab = (typeof TABS)[number]

export default function AdminPage() {
  useDocumentTitle('Admin desk')
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'overview'
  const queue = useQuery({ queryKey: ['admin', 'queue'], queryFn: api.adminQueue })
  const pending = queue.data?.length ?? 0

  return (
    <Container>
      <PageHeader title="Admin desk" description="Review claims, confirm handovers and see where things go missing." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList aria-label="Admin sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queue">
            Claim queue
            {pending > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cobalt px-1.5 text-xs font-bold text-on-cobalt">
                {pending}
                <span className="sr-only"> waiting</span>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="handover">Handover</TabsTrigger>
          <TabsTrigger value="hotspots">Hotspots</TabsTrigger>
          <TabsTrigger value="flagged">Flagged and expired</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <StatsCards />
        </TabsContent>
        <TabsContent value="queue">
          <ClaimQueue />
        </TabsContent>
        <TabsContent value="handover">
          <HandoverDesk />
        </TabsContent>
        <TabsContent value="hotspots">
          <HotspotGrid />
        </TabsContent>
        <TabsContent value="flagged">
          <FlaggedExpired />
        </TabsContent>
      </Tabs>
    </Container>
  )
}
