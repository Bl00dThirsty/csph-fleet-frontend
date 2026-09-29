import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { SiteVerificationsScreen } from '@/features/sites'
import { useAuthStore } from '@/store/auth-store'
import type { SiteRole } from '@/features/sites/lib/site-status-machine'

const route = getRouteApi('/_authenticated/site-verifications/')

function SiteVerificationsRouteComponent() {
  const role = useAuthStore((s) => s.user?.system_role) as SiteRole | undefined
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return (
    <SiteVerificationsScreen
      role={role ?? 'AGENT'}
      search={search}
      navigate={navigate}
    />
  )
}

export const Route = createFileRoute('/_authenticated/site-verifications/')({
  component: SiteVerificationsRouteComponent,
})
