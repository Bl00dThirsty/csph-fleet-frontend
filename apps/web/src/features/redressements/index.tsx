import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { CheckCircle2, Clock, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { KpiTile, PageShell, SectionCard } from '@/components/layout/page'
import { RedressementsTable } from './components/redressements-table'
import { getRedressements, getRedressementSummary } from './data/redressements'

const route = getRouteApi('/_authenticated/redressements/')

export function RedressementsPage() {
  const rows = useMemo(() => getRedressements(), [])
  const summary = useMemo(() => getRedressementSummary(rows), [rows])
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <PageShell>
      <PageHeader
        title='Redressements'
        description='Montants à recouvrer suite aux écarts de volume constatés en réconciliation.'
      />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiTile label='Total' value={String(summary.total)} icon={<Receipt className='size-4 text-primary' />} />
        <KpiTile label='Émis' value={String(summary.issued)} icon={<Clock className='size-4 text-amber-500' />} />
        <KpiTile label='Payés' value={String(summary.paid)} icon={<CheckCircle2 className='size-4 text-emerald-500' />} />
        <KpiTile
          label='En cours'
          value={`${summary.totalOutstanding.toLocaleString('fr-FR')} XFA`}
        />
      </div>
      <SectionCard>
        <RedressementsTable rows={rows} search={search} navigate={navigate} />
      </SectionCard>
    </PageShell>
  )
}