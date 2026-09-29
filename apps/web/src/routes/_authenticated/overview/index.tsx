import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useRoleStore } from '@/store/role-store'
import { DashboardPage } from '@/features/dashboard'

const route = getRouteApi('/_authenticated/overview/')

function OverviewRouteComponent() {
  const role = useRoleStore((s) => s.activeRole)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <DashboardPage role={role} search={search} navigate={navigate} />
}

export const Route = createFileRoute('/_authenticated/overview/')({
  component: OverviewRouteComponent,
})
