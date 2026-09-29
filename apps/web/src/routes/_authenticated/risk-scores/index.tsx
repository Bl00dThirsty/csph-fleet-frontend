import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { RiskScoresPage } from '@/features/risks'

const route = getRouteApi('/_authenticated/risk-scores/')

export const Route = createFileRoute('/_authenticated/risk-scores/')({
  component: RiskScoresIndexComponent,
})

function RiskScoresIndexComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <RiskScoresPage search={search} navigate={navigate} />
}
