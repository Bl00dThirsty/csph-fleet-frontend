import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { DashboardPage } from '@/features/dashboard'

const route = getRouteApi('/_authenticated/dashboard-supervisor/')

export const Route = createFileRoute('/_authenticated/dashboard-supervisor/')({
  component: DashboardSupervisorComponent,
})

function DashboardSupervisorComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <DashboardPage role='SUPERVISOR' search={search} navigate={navigate} />
}
