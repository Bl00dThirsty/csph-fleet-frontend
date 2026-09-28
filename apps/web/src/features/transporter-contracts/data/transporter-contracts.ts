import { transporter_contracts, organizations } from '@/lib/entity-data'
import type { Organization, TransporterContract } from '@lpg/types'

export interface TransporterContractView {
  id: string
  reference: string
  marketeur_name: string
  transporter_name: string
  start_date: string
  end_date: string | null
  is_primary: boolean
  is_active: boolean
}

function orgName(id: string, orgs: Organization[] = organizations): string {
  return orgs.find((o) => o.id === id)?.name ?? id
}

export function getTransporterContracts(
  contracts: TransporterContract[] = transporter_contracts,
  orgs: Organization[] = organizations,
): TransporterContractView[] {
  return contracts
    .map((tc) => ({
      id: tc.id,
      reference: tc.contract_reference ?? tc.id,
      marketeur_name: orgName(tc.marketeur_org_id, orgs),
      transporter_name: orgName(tc.transporter_org_id, orgs),
      start_date: (tc.started_at ?? tc.created_at ?? '').slice(0, 10),
      end_date: tc.ended_at ? tc.ended_at.slice(0, 10) : null,
      is_primary: tc.is_primary,
      is_active: tc.is_active,
    }))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
}

export function getTransporterContractSummary(rows: TransporterContractView[]) {
  return {
    total: rows.length,
    active: rows.filter((r) => r.is_active).length,
    primary: rows.filter((r) => r.is_primary).length,
    inactive: rows.filter((r) => !r.is_active).length,
  }
}