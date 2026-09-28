import { api } from '@lpg/api-client'
import type {
  Organization as CuratedOrganization,
  Region,
} from '@lpg/types'

export type { OrgType } from '@lpg/types'

export type SiteStatus = 'UNASSIGNED' | 'ASSIGNED' | 'ACTIVE' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED'

export interface Organization {
  id: string
  name: string
  type: CuratedOrganization['type']
  status: SiteStatus
  region: Region
  city: string
  sites: number
  created_at: string
  updated_at: string
}

const CITY_BY_REGION: Record<Region, string> = {
  ADAMAOUA: 'Ngaoundéré',
  CENTRE: 'Yaoundé',
  EST: 'Bertoua',
  EXTREMENORD: 'Maroua',
  LITTORAL: 'Douala',
  NORD: 'Garoua',
  NORDOUEST: 'Bamenda',
  OUEST: 'Bafoussam',
  SUD: 'Ebolowa',
  SUDOUEST: 'Buéa',
}

const FALLBACK_REGIONS: readonly Region[] = [
  'CENTRE', 'LITTORAL', 'ADAMAOUA', 'EST', 'EXTREMENORD',
  'NORD', 'NORDOUEST', 'OUEST', 'SUD', 'SUDOUEST',
]

/**
 * Synchronous accessor — returns the live org cache if the host page already
 * triggered an `api.organizations.list()` fetch. Pages that need a live list
 * should call `fetchOrganizations()` on mount and pass the result in.
 */
export function getOrganizations(raw: CuratedOrganization[] = []): Organization[] {
  return raw.map((org, idx) => {
    const region: Region = ((org as any).region as Region | undefined) ?? FALLBACK_REGIONS[idx % FALLBACK_REGIONS.length] ?? 'CENTRE'
    return {
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.is_active ? 'ACTIVE' : 'SUSPENDED',
      region,
      city: CITY_BY_REGION[region] ?? '—',
      sites: (org as any).operational_site_count ?? 0,
      created_at: org.created_at ?? '2026-01-01',
      updated_at: org.updated_at ?? '2026-01-01',
    }
  })
}

/**
 * Async helper for pages that want the live org list directly. Returns an
 * empty array on any failure — the previous curated.* fallback is gone.
 */
export async function fetchOrganizations(): Promise<CuratedOrganization[]> {
  try {
    const res = await api.organizations.list({ size: 200 })
    return ((res.data ?? []) as unknown) as CuratedOrganization[]
  } catch {
    return []
  }
}

/** Backwards-compatible empty seed used by tests and any stragglers that
 *  imported the old `organizations` constant. */
export const organizations: Organization[] = []

export const ORG_TYPE_LABELS: Record<CuratedOrganization['type'], string> = {
  REGULATEUR: 'Régulateur',
  DEPOT: 'Dépôt',
  MARKETEUR: 'Marketeur',
  TRANSPORTEUR: 'Transporteur',
  CLIENT: 'Client',
}

export function orgTypeLabel(type: CuratedOrganization['type']): string {
  return ORG_TYPE_LABELS[type]
}

export const ORG_STATUS_LABELS: Record<SiteStatus, string> = {
  UNASSIGNED: 'Non assigné',
  ASSIGNED: 'Assigné',
  ACTIVE: 'Actif',
  VERIFIED: 'Vérifié',
  SUSPENDED: 'Suspendu',
  REJECTED: 'Rejeté',
}

export function orgStatusLabel(status: SiteStatus): string {
  return ORG_STATUS_LABELS[status]
}