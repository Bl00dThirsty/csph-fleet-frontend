import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { DashboardPage } from '@/features/dashboard'

const route = getRouteApi('/_authenticated/dashboard/')

export const Route = createFileRoute('/_authenticated/dashboard/')({
  component: DashboardIndexComponent,
})

function DashboardIndexComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <DashboardPage search={search} navigate={navigate} />
}
