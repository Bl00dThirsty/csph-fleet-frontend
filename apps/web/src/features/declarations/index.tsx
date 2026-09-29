import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { FileBarChart } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { KpiTile, PageShell, SectionCard } from '@/components/layout/page'
import { DeclarationsTable } from './components/declarations-table'
import { getDeclarations, getDeclarationSummary } from './data/declarations'

const route = getRouteApi('/_authenticated/declarations/')

export function DeclarationsPage() {
  const rows = useMemo(() => getDeclarations(), [])
  const summary = useMemo(() => getDeclarationSummary(rows), [rows])
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <PageShell>
      <PageHeader
        title='Déclarations'
        description='Déclarations mensuelles des marketeurs, du brouillon à la réconciliation.'
      />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiTile label='Total' value={String(summary.total)} icon={<FileBarChart className='size-4 text-primary' />} />
        <KpiTile label='Soumises' value={String(summary.submitted)} />
        <KpiTile label='Réconciliées' value={String(summary.reconciled)} />
        <KpiTile label='Contestées' value={String(summary.disputed)} />
      </div>
      <SectionCard>
        <DeclarationsTable rows={rows} search={search} navigate={navigate} />
      </SectionCard>
    </PageShell>
  )
}