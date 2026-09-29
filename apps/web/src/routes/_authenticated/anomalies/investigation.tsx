import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { AnomaliesPage } from '@/features/anomalies'

const route = getRouteApi('/_authenticated/anomalies/investigation')

export const Route = createFileRoute('/_authenticated/anomalies/investigation')({
  component: AnomaliesInvestigationComponent,
})

function AnomaliesInvestigationComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <AnomaliesPage track='INVESTIGATION' search={search} navigate={navigate} />
}
