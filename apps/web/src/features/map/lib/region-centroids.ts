/**
 * Region centroids derived from live site coordinates.
 *
 * `RegionEntity` in `@lpg/types` has no coordinate fields, so the only
 * defensible source of region geometry is the sites that belong to it.
 * A region with no geocoded sites is OMITTED — never placed at 0,0
 * (AGENTS.md §4: no invented coordinates).
 *
 * `siteCount` / `clientSiteCount` / `anomalyCount` are returned as 0; the
 * caller owns those aggregates. This function owns position only.
 */

import type { Region } from '@lpg/types'
import type { RegionSummary } from './regions'

export interface GeoPoint {
  longitude: number
  latitude: number
}

export function computeRegionCentroids(
  regions: readonly { code: Region; name: string }[],
  points: readonly (GeoPoint & { region: Region })[],
): RegionSummary[] {
  const sums = new Map<Region, { lng: number; lat: number; count: number }>()

  for (const point of points) {
    const acc = sums.get(point.region)
    if (acc) {
      acc.lng += point.longitude
      acc.lat += point.latitude
      acc.count += 1
    } else {
      sums.set(point.region, {
        lng: point.longitude,
        lat: point.latitude,
        count: 1,
      })
    }
  }

  const summaries: RegionSummary[] = []
  for (const region of regions) {
    const acc = sums.get(region.code)
    if (!acc || acc.count === 0) continue
    summaries.push({
      code: region.code,
      name: region.name,
      siteCount: 0,
      clientSiteCount: 0,
      anomalyCount: 0,
      longitude: acc.lng / acc.count,
      latitude: acc.lat / acc.count,
    })
  }
  return summaries
}
