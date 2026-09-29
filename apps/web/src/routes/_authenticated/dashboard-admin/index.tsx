import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { DashboardPage } from '@/features/dashboard'

const route = getRouteApi('/_authenticated/dashboard-admin/')

export const Route = createFileRoute('/_authenticated/dashboard-admin/')({
  component: DashboardAdminComponent,
})

function DashboardAdminComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <DashboardPage role='ADMIN' search={search} navigate={navigate} />
}
