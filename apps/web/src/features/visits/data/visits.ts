import { client_sites as defaultClientSites, organizations as defaultOrganizations } from '@/lib/entity-data'
import type { ClientSite, Organization } from '@lpg/types'

export interface VisitView {
  id: string
  clientName: string
  siteName: string
  region: string
  status: 'VERIFIE' | 'PENDING'
  statusLabel: string
  verifiedAt: string | null
}

export function getVisits(
  sites: ClientSite[] = defaultClientSites as ClientSite[],
  orgs: Pick<Organization, 'id' | 'name'>[] = defaultOrganizations as Pick<
    Organization,
    'id' | 'name'
  >[],
): VisitView[] {
  const orgNameById: Record<string, string> = Object.fromEntries(
    orgs.map((o) => [o.id, o.name]),
  )
  return sites.map((site) => ({
    id: site.id,
    clientName: orgNameById[site.client_org_id] ?? site.client_org_id,
    siteName: site.name,
    region: site.region,
    status: site.is_verified ? 'VERIFIE' : 'PENDING',
    statusLabel: site.is_verified ? 'Vérifié' : 'En attente de vérification',
    verifiedAt: site.verified_at ?? null,
  }))
}

export function getVisitSummary(
  sites?: ClientSite[],
  orgs?: Pick<Organization, 'id' | 'name'>[],
) {
  const rows = getVisits(sites, orgs)
  return {
    total: rows.length,
    verified: rows.filter((r) => r.status === 'VERIFIE').length,
    pending: rows.filter((r) => r.status === 'PENDING').length,
  }
}

export function getVisitsByRegion(
  sites?: ClientSite[],
  orgs?: Pick<Organization, 'id' | 'name'>[],
): Record<string, number> {
  const rows = getVisits(sites, orgs)
  const byRegion: Record<string, number> = {}
  for (const row of rows) {
    byRegion[row.region] = (byRegion[row.region] ?? 0) + 1
  }
  return byRegion
}