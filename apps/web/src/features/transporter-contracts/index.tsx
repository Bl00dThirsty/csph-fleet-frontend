import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { CheckCircle2, FileSignature, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { KpiTile, PageShell, SectionCard } from '@/components/layout/page'
import { TransporterContractsTable } from './components/transporter-contracts-table'
import { getTransporterContracts, getTransporterContractSummary } from './data/transporter-contracts'

const route = getRouteApi('/_authenticated/transporter-contracts/')

export function TransporterContractsPage() {
  const rows = useMemo(() => getTransporterContracts(), [])
  const summary = useMemo(() => getTransporterContractSummary(rows), [rows])
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <PageShell>
      <PageHeader
        title='Contrats transporteurs'
        description='Conventions marketeur-transporteur, avec marquage du contrat principal.'
      />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <KpiTile label='Total' value={String(summary.total)} icon={<FileSignature className='size-4 text-primary' />} />
        <KpiTile label='Actifs' value={String(summary.active)} icon={<CheckCircle2 className='size-4 text-emerald-500' />} />
        <KpiTile label='Principaux' value={String(summary.primary)} icon={<ShieldCheck className='size-4 text-indigo-500' />} />
      </div>
      <SectionCard>
        <TransporterContractsTable rows={rows} search={search} navigate={navigate} />
      </SectionCard>
    </PageShell>
  )
}