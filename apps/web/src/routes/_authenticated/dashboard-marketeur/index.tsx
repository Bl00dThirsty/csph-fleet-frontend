import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { DashboardPage } from '@/features/dashboard'

const route = getRouteApi('/_authenticated/dashboard-marketeur/')

export const Route = createFileRoute('/_authenticated/dashboard-marketeur/')({
  component: DashboardMarketeurComponent,
})

function DashboardMarketeurComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <DashboardPage role='MARKETEUR' search={search} navigate={navigate} />
}
