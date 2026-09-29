import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { AnomaliesPage } from '@/features/anomalies'

const route = getRouteApi('/_authenticated/anomalies/technical')

export const Route = createFileRoute('/_authenticated/anomalies/technical')({
  component: AnomaliesTechnicalComponent,
})

function AnomaliesTechnicalComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <AnomaliesPage track='TECHNICAL' search={search} navigate={navigate} />
}
