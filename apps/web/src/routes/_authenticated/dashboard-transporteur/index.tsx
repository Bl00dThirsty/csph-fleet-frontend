import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { DashboardPage } from '@/features/dashboard'

const route = getRouteApi('/_authenticated/dashboard-transporteur/')

export const Route = createFileRoute('/_authenticated/dashboard-transporteur/')({
  component: DashboardTransporteurComponent,
})

function DashboardTransporteurComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <DashboardPage role='TRANSPORTEUR' search={search} navigate={navigate} />
}
