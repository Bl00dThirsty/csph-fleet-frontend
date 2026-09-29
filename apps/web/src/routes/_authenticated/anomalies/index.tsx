import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { AnomaliesPage } from '@/features/anomalies'

const route = getRouteApi('/_authenticated/anomalies/')

export const Route = createFileRoute('/_authenticated/anomalies/')({
  component: AnomaliesIndexComponent,
})

function AnomaliesIndexComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <AnomaliesPage track='ALL' search={search} navigate={navigate} />
}
