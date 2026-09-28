import { curated } from '@/lib/entity-data'
import type {
  Organization as CuratedOrganization,
  Region,
  Site as CuratedSite,
} from '@lpg/types'

export type DepotStatus = 'ACTIVE' | 'SUSPENDED'

export interface DepotView {
  id: string
  name: string
  status: DepotStatus
  region: Region
  city: string
  sites: number
  created_at: string
  updated_at: string
}

const CITY_BY_REGION: Record<Region, string> = {
  ADAMAOUA: 'NgaoundÃ©rÃ©',
  CENTRE: 'YaoundÃ©',
  EST: 'Bertoua',
  EXTREMENORD: 'Maroua',
  LITTORAL: 'Douala',
  NORD: 'Garoua',
  NORDOUEST: 'Bamenda',
  OUEST: 'Bafoussam',
  SUD: 'Ebolowa',
  SUDOUEST: 'BuÃ©a',
}

function regionForDepot(orgId: string, idx: number): Region {
  const sites = curated.sites as CuratedSite[]
  const owningSite = sites.find((s) => s.org_id === orgId)
  if (owningSite) return owningSite.region
  // curated.regions is empty in the stub; fall back to a stable rotation.
  const fallbackRegions: Region[] = [
    'CENTRE', 'LITTORAL', 'ADAMAOUA', 'EST', 'EXTREMENORD',
    'NORD', 'NORDOUEST', 'OUEST', 'SUD', 'SUDOUEST',
  ]
  return fallbackRegions[idx % fallbackRegions.length] ?? 'CENTRE'
}

export function getDepots(): DepotView[] {
  const orgs = curated.organizations as CuratedOrganization[]
  const sites = curated.sites as CuratedSite[]
  return orgs
    .filter((org) => org.type === 'DEPOT')
    .map((org, idx) => {
      const region = regionForDepot(org.id, idx)
      return {
        id: org.id,
        name: org.name,
        status: org.is_active ? 'ACTIVE' : 'SUSPENDED',
        region,
        city: CITY_BY_REGION[region] ?? 'â€”',
        sites: sites.filter((s) => s.org_id === org.id).length,
        created_at: org.created_at ?? '2026-01-01',
        updated_at: org.updated_at ?? '2026-01-01',
      }
    })
}

export const DEPOT_STATUS_LABELS: Record<DepotStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
}

export function depotStatusLabel(status: DepotStatus): string {
  return DEPOT_STATUS_LABELS[status]
}