import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { RiskScoresPage } from '@/features/risks'

const route = getRouteApi('/_authenticated/risks/')

export const Route = createFileRoute('/_authenticated/risks/')({
  component: RisksIndexComponent,
})

function RisksIndexComponent() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return <RiskScoresPage search={search} navigate={navigate} />
}
