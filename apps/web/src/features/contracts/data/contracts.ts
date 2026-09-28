import { transporter_contracts, organizations } from '@/lib/entity-data'
import type { Organization, TransporterContract } from '@lpg/types'

export interface ContractByTransporter {
  transporterId: string
  transporterName: string
  contractCount: number
  activeCount: number
  primaryCount: number
  marketeurs: string[]
}

function orgName(id: string, orgs: Organization[] = organizations): string {
  return orgs.find((o) => o.id === id)?.name ?? id
}

export function getContractsByTransporter(
  contracts: TransporterContract[] = transporter_contracts,
  orgs: Organization[] = organizations,
): ContractByTransporter[] {
  const groups = new Map<string, {
    transporterId: string
    transporterName: string
    contractCount: number
    activeCount: number
    primaryCount: number
    marketeurs: Set<string>
  }>()

  for (const tc of contracts) {
    const current = groups.get(tc.transporter_org_id) ?? {
      transporterId: tc.transporter_org_id,
      transporterName: orgName(tc.transporter_org_id, orgs),
      contractCount: 0,
      activeCount: 0,
      primaryCount: 0,
      marketeurs: new Set<string>(),
    }
    current.contractCount += 1
    if (tc.is_active) current.activeCount += 1
    if (tc.is_primary) current.primaryCount += 1
    current.marketeurs.add(orgName(tc.marketeur_org_id, orgs))
    groups.set(tc.transporter_org_id, current)
  }

  return Array.from(groups.values())
    .map((g) => ({
      transporterId: g.transporterId,
      transporterName: g.transporterName,
      contractCount: g.contractCount,
      activeCount: g.activeCount,
      primaryCount: g.primaryCount,
      marketeurs: Array.from(g.marketeurs),
    }))
    .sort((a, b) => b.contractCount - a.contractCount)
}

export function getContractSummary(
  contracts: TransporterContract[] = transporter_contracts,
  orgs: Organization[] = organizations,
) {
  const rows = getContractsByTransporter(contracts, orgs)
  const totalContracts = contracts.length
  return {
    transporters: rows.length,
    totalContracts,
    active: contracts.filter((c) => c.is_active).length,
    primary: contracts.filter((c) => c.is_primary).length,
  }
}