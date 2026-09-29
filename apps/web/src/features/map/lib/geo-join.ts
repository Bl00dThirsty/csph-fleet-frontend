/**
 * Anomaly -> position join.
 *
 * Anomalies have no coordinates of their own; they reference a site or a
 * client site. This replaces the previous lookup against the deleted
 * `curated` seed: rows are now injected by the caller.
 *
 * Order matters: `site_id` wins, then `client_site_id`. An anomaly that
 * resolves to neither is dropped rather than plotted at 0,0.
 */

import type { Anomaly } from '@lpg/types'
import type { GeoAnomalyView } from '../data/geo-anomalies'

export interface SiteGeoRef {
  id: string
  name: string
  longitude: number
  latitude: number
}

export function joinAnomalyGeo(
  anomalies: readonly Anomaly[],
  sites: readonly SiteGeoRef[],
  clientSites: readonly SiteGeoRef[],
): GeoAnomalyView[] {
  const siteById = new Map(sites.map((s) => [s.id, s]))
  const clientSiteById = new Map(clientSites.map((s) => [s.id, s]))

  const views: GeoAnomalyView[] = []
  for (const anomaly of anomalies) {
    const site = anomaly.site_id ? siteById.get(anomaly.site_id) : undefined
    const clientSite = anomaly.client_site_id
      ? clientSiteById.get(anomaly.client_site_id)
      : undefined
    const ref = site ?? clientSite
    if (!ref) continue

    views.push({
      id: anomaly.id,
      type: anomaly.type,
      category: anomaly.category,
      severity: anomaly.severity,
      status: anomaly.status,
      entity_type: anomaly.entity_type ?? null,
      entity_id: anomaly.entity_id ?? null,
      entity_label: ref.name ?? anomaly.entity_id ?? null,
      latitude: ref.latitude,
      longitude: ref.longitude,
    })
  }
  return views
}
