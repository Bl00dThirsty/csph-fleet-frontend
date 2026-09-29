import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { SitesScreen } from '@/features/sites'
import { useAuthStore } from '@/store/auth-store'
import type { SiteRole } from '@/features/sites/lib/site-status-machine'

const route = getRouteApi('/_authenticated/sites/')

function SitesRouteComponent() {
  const role = useAuthStore((s) => s.user?.system_role) as SiteRole | undefined
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return (
    <SitesScreen
      kind='site'
      role={role ?? 'MARKETEUR'}
      search={search}
      navigate={navigate}
    />
  )
}

export const Route = createFileRoute('/_authenticated/sites/')({
  component: SitesRouteComponent,
})
