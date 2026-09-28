import type { Region } from '@lpg/types'
import { getZones } from '../../zones/data/zones'

const REGION_LABELS: Record<Region, string> = {
  ADAMAOUA: 'Adamaoua',
  CENTRE: 'Centre',
  EST: 'Est',
  EXTREMENORD: 'Extrême-Nord',
  LITTORAL: 'Littoral',
  NORD: 'Nord',
  NORDOUEST: 'Nord-Ouest',
  OUEST: 'Ouest',
  SUD: 'Sud',
  SUDOUEST: 'Sud-Ouest',
}

export interface RegionSummary {
  code: Region
  name: string
  siteCount: number
  clientSiteCount: number
  anomalyCount: number
  longitude: number
  latitude: number
}

export function getRegionSummary(code: Region): RegionSummary {
  const zone = getZones().find((z) => z.region === code)
  // curated seed is empty — centroid / site points are no live either.
  // Map view computes them from api.sites.list / api.clientSites.list.
  return {
    code,
    name: REGION_LABELS[code] ?? code,
    siteCount: zone?.siteCount ?? 0,
    clientSiteCount: zone?.clientSiteCount ?? 0,
    anomalyCount: 0,
    longitude: 0,
    latitude: 0,
  }
}

export function regionsForMap(): readonly RegionSummary[] {
  // curated.regions is now empty (mock-data stub); live region list comes from
  // api.regions.list() which is wired via the regions-store. Pages that need
  // a populated list should call regionsForMap() once the store is hydrated.
  return []
}
