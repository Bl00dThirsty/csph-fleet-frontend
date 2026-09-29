import { useMemo } from 'react'
import { AlertOctagon, FileWarning, Gauge } from 'lucide-react'
import type { NavigateFn } from '@/hooks/use-table-url-state'
import { PageHeader } from '@/components/layout/page-header'
import { KpiTile, PageShell, SectionCard } from '@/components/layout/page'
import { RiskScoresTable } from './components/risk-scores-table'
import { getRiskScores, getRiskSummary } from './data/risk-scores'

export function RiskScoresPage({ search, navigate }: { search: Record<string, unknown>; navigate: NavigateFn }) {
  const rows = useMemo(() => getRiskScores(), [])
  const summary = useMemo(() => getRiskSummary(rows), [rows])

  return (
    <PageShell>
      <PageHeader
        title='Scores de risque'
        description='Modèle CSPH-RISK — notation des marketeurs, transporteurs, sites et véhicules.'
      />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiTile label='Entités notées' value={String(summary.total)} icon={<FileWarning className='size-4 text-primary' />} />
        <KpiTile label='Score moyen' value={String(summary.average)} icon={<Gauge className='size-4 text-sky-500' />} />
        <KpiTile label='Élevé' value={String(summary.eleve)} />
        <KpiTile label='Critique' value={String(summary.critique)} icon={<AlertOctagon className='size-4 text-rose-500' />} />
      </div>
      <SectionCard>
        <RiskScoresTable rows={rows} search={search} navigate={navigate} />
      </SectionCard>
    </PageShell>
  )
}