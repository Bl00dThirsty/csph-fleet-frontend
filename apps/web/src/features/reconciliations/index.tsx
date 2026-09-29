import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { AlertTriangle, Coins, FileBarChart, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { KpiTile, PageShell, SectionCard } from '@/components/layout/page'
import { ReconciliationsTable } from './components/reconciliations-table'
import { getReconciliations, getReconciliationSummary, gapToleranceThreshold } from './data/reconciliations'

const route = getRouteApi('/_authenticated/reconciliations/')

export function ReconciliationsPage() {
  const rows = useMemo(() => getReconciliations(), [])
  const summary = useMemo(() => getReconciliationSummary(rows), [rows])
  const tolerance = gapToleranceThreshold()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <PageShell>
      <PageHeader
        title='Réconciliations'
        description='Déclaré contre suivi — détection des écarts de volume et impact sur la subvention.'
      />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiTile label='Total' value={String(summary.total)} icon={<FileBarChart className='size-4 text-primary' />} />
        <KpiTile
          label={`Écarts > ${tolerance.toLocaleString('fr-FR')} %`}
          value={String(summary.flagged)}
          icon={<AlertTriangle className='size-4 text-rose-500' />}
        />
        <KpiTile
          label='Redressements'
          value={String(summary.redressement)}
          icon={<Receipt className='size-4 text-violet-500' />}
        />
        <KpiTile
          label='Impact subvention'
          value={`${summary.totalSubsidy / 1e6} M XFA`}
          icon={<Coins className='size-4 text-emerald-500' />}
        />
      </div>
      <SectionCard>
        <ReconciliationsTable rows={rows} search={search} navigate={navigate} />
      </SectionCard>
    </PageShell>
  )
}