/**
 * zones — stub. The /zones page used to enumerate the curated regions and
 * count sites per region. Live region list now comes from `api.regions.list()`
 * (via the regions-store), site counts from `api.sites.list()` and
 * `api.clientSites.list()`. Pages that need populated data should call
 * `buildZoneViews()` once those stores are hydrated.
 */

import type { Region } from '@lpg/types'

export interface ZoneView {
  id: string
  code: Region
  name: string
  siteCount: number
  clientSiteCount: number
  region: Region
}

export function getZones(): ZoneView[] {
  // Empty seed; live regions arrive via the regions store.
  return []
}

export function getZoneOptions(): { label: string; value: string }[] {
  return []
}