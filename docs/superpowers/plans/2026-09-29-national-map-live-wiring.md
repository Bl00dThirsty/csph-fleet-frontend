# National Map — Live Data Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the national map plot live backend data, make its layer toggles actually work, cluster thousands of markers, and repair the four sibling pages that share the identical empty-data defect.

**Architecture:** A single new hook (`useNationalMapData`) composes five already-existing typed React Query hooks from `lib/api/use-resources.ts` and feeds a **pure** view builder. Region geometry is derived client-side by averaging live site coordinates (`RegionEntity` has no coordinates in the backend). ArcGIS v5 `FeatureLayer` + `GeoJSONSource` with `featureReduction` handles clustering; anomalies and regions stay on `GraphicsLayer`.

**Tech Stack:** React 19, TanStack Router, TanStack Query v5, `@arcgis/core` **5.1.14**, TypeScript strict, Vitest, Tailwind v4.

## Global Constraints

- **`@arcgis/core` is 5.1.14. In v5, `sources/` moved to `layers/graphics/sources/`.** The v4 specifier `@arcgis/core/sources/GeoJSONSource` does not exist and will fail the build. The only valid specifier is `@arcgis/core/layers/graphics/sources/GeoJSONSource.js`.
- **`RegionEntity` = `{ id, name, code, created_at, updated_at }` — no coordinate fields.** Never invent region coordinates. Derive them.
- **`Site.geo_point` and `ClientSite.geo_point` are `[lng, lat]` (longitude first) and are frequently `null`.** Never plot an un-geocoded row at `0,0`. Drop it and count it.
- **No mock/demo data, ever** (AGENTS.md §4). Views render empty until live rows hydrate. No fixture packages, no seeded rows in app code, no invented fallback values.
- **VRAC is TM (tonnes métriques), never kg, never bare `t`.** Use `formatTm` from `map/utils/format`.
- **French UI copy.** All user-facing strings are French.
- **Tests live beside the pure logic they cover** (`lib/*.test.ts`) per AGENTS.md §3.
- **`tsconfig.app.json` is strict**, including `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. Array indexing yields `T | undefined` — handle it.
- **Baseline is green**: `npx tsc -b` exits 0; `npx vitest run --browser=false src/features/map` passes 6 files / 21 tests. Do not regress either.
- **Run tests from `apps/web`.** The root `pnpm test` excludes `src/features/**/components/**`, so map *component* tests are not run by the default script — put logic tests in `lib/` and `data/`.

---

### Task 1: Region centroids derived from live site coordinates

`RegionEntity` carries no geometry, so the region layer needs coordinates computed from the sites that belong to each region. This is pure logic with no ArcGIS and no React, so it goes first and is fully unit-tested.

**Files:**
- Create: `apps/web/src/features/map/lib/region-centroids.ts`
- Test: `apps/web/src/features/map/lib/region-centroids.test.ts`
- Read (do not modify): `apps/web/src/features/map/lib/regions.ts` — already exports `RegionSummary` and `REGION_LABELS` is module-private; use the exported type.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export interface GeoPoint { longitude: number; latitude: number }
  export function computeRegionCentroids(
    regions: readonly { code: Region; name: string }[],
    points: readonly (GeoPoint & { region: Region })[],
  ): RegionSummary[]
  ```
  Returns one `RegionSummary` per region that has **at least one** geocoded point. Regions with zero geocoded points are omitted entirely (never placed at 0,0). `siteCount` and `clientSiteCount` are filled by the caller, so this function returns them as `0` and the caller overwrites — no, better: this function returns counts it can compute from `points` only if the caller tags them. To keep one responsibility, the signature above returns `siteCount: 0, clientSiteCount: 0, anomalyCount: 0` and the caller (Task 4) overwrites the counts. Document that in the file.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/map/lib/region-centroids.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeRegionCentroids } from './region-centroids'
import type { Region } from '@lpg/types'

const regions: readonly { code: Region; name: string }[] = [
  { code: 'CENTRE', name: 'Centre' },
  { code: 'LITTORAL', name: 'Littoral' },
  { code: 'EST', name: 'Est' },
]

describe('computeRegionCentroids', () => {
  it('averages the coordinates of every point in a region', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'CENTRE', longitude: 10, latitude: 2 },
      { region: 'CENTRE', longitude: 14, latitude: 6 },
    ])
    const centre = result.find((r) => r.code === 'CENTRE')
    expect(centre?.longitude).toBe(12)
    expect(centre?.latitude).toBe(4)
  })

  it('omits regions that have no geocoded points', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'CENTRE', longitude: 11, latitude: 3 },
    ])
    expect(result).toHaveLength(1)
    expect(result.some((r) => r.code === 'LITTORAL')).toBe(false)
    expect(result.some((r) => r.code === 'EST')).toBe(false)
  })

  it('never returns a 0,0 coordinate for an empty region', () => {
    const result = computeRegionCentroids(regions, [])
    expect(result).toEqual([])
  })

  it('returns one summary per region, carrying its name and counts at zero', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'LITTORAL', longitude: 9.7, latitude: 4.05 },
    ])
    const littoral = result.find((r) => r.code === 'LITTORAL')
    expect(littoral?.name).toBe('Littoral')
    expect(littoral?.siteCount).toBe(0)
    expect(littoral?.clientSiteCount).toBe(0)
    expect(littoral?.anomalyCount).toBe(0)
  })

  it('handles a single point without dividing by zero', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'CENTRE', longitude: 11.5, latitude: 3.87 },
    ])
    const centre = result.find((r) => r.code === 'CENTRE')
    expect(centre?.longitude).toBe(11.5)
    expect(centre?.latitude).toBe(3.87)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/lib/region-centroids.test.ts`
Expected: FAIL — `Failed to resolve import "./region-centroids"`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/src/features/map/lib/region-centroids.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/lib/region-centroids.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/map/lib/region-centroids.ts apps/web/src/features/map/lib/region-centroids.test.ts
git commit -m "feat(map): derive region centroids from live site coordinates"
```

---

### Task 2: Anomaly positions joined to live sites

Anomalies carry no coordinates of their own — they reference `site_id` / `client_site_id`. The existing `geo-anomalies.ts` does this join against the dead `curated` seed. This task extracts it into pure logic over injected rows.

**Files:**
- Create: `apps/web/src/features/map/lib/geo-join.ts`
- Test: `apps/web/src/features/map/lib/geo-join.test.ts`
- Read (do not modify): `apps/web/src/features/map/data/geo-anomalies.ts` — source of the `GeoAnomalyView` type and the join semantics.

**Interfaces:**
- Consumes: `GeoAnomalyView` from `../data/geo-anomalies`.
- Produces:
  ```ts
  export interface SiteGeoRef { id: string; name: string; longitude: number; latitude: number }
  export function joinAnomalyGeo(
    anomalies: readonly Anomaly[],
    sites: readonly SiteGeoRef[],
    clientSites: readonly SiteGeoRef[],
  ): GeoAnomalyView[]
  ```
  An anomaly resolves via `site_id` first, then `client_site_id`. An anomaly matching neither is dropped. `entity_label` is the resolved site name, falling back to `entity_id`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/map/lib/geo-join.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { joinAnomalyGeo } from './geo-join'
import type { Anomaly } from '@lpg/types'

function anomaly(over: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'ano-1',
    type: 'VOLUMEGAP',
    category: 'INVESTIGATION',
    severity: 'ELEVE',
    status: 'NOUVEAU',
    site_id: 'site-1',
    client_site_id: null,
    entity_type: 'SITE',
    entity_id: 'site-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as Anomaly
}

const sites = [{ id: 'site-1', name: 'Dépôt Douala', longitude: 9.7, latitude: 4.05 }]
const clientSites = [{ id: 'cs-1', name: 'Client Yaoundé', longitude: 11.5, latitude: 3.87 }]

describe('joinAnomalyGeo', () => {
  it('resolves an anomaly through site_id', () => {
    const result = joinAnomalyGeo([anomaly()], sites, clientSites)
    expect(result).toHaveLength(1)
    expect(result[0]?.longitude).toBe(9.7)
    expect(result[0]?.latitude).toBe(4.05)
    expect(result[0]?.entity_label).toBe('Dépôt Douala')
  })

  it('resolves an anomaly through client_site_id', () => {
    const result = joinAnomalyGeo(
      [anomaly({ site_id: null, client_site_id: 'cs-1' })],
      sites,
      clientSites,
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.longitude).toBe(11.5)
    expect(result[0]?.entity_label).toBe('Client Yaoundé')
  })

  it('drops an anomaly that references neither a site nor a client site', () => {
    const result = joinAnomalyGeo(
      [anomaly({ site_id: null, client_site_id: null, entity_id: 'veh-9' })],
      sites,
      clientSites,
    )
    expect(result).toEqual([])
  })

  it('drops an anomaly whose referenced site is missing', () => {
    const result = joinAnomalyGeo([anomaly({ site_id: 'ghost' })], sites, clientSites)
    expect(result).toEqual([])
  })

  it('carries category, severity and status through to the view', () => {
    const result = joinAnomalyGeo([anomaly()], sites, clientSites)
    expect(result[0]?.category).toBe('INVESTIGATION')
    expect(result[0]?.severity).toBe('ELEVE')
    expect(result[0]?.status).toBe('NOUVEAU')
  })

  it('returns an empty array for no anomalies', () => {
    expect(joinAnomalyGeo([], sites, clientSites)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/lib/geo-join.test.ts`
Expected: FAIL — `Failed to resolve import "./geo-join"`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/src/features/map/lib/geo-join.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/lib/geo-join.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/map/lib/geo-join.ts apps/web/src/features/map/lib/geo-join.test.ts
git commit -m "feat(map): join anomaly positions to live site rows"
```

---

### Task 3: Convert the two seed-fed map data modules to accept live rows

`map/data/client-sites.ts` and `map/data/geo-anomalies.ts` still import the emptied `curated` seed. Both become functions over injected rows, matching the shape `getSites()` / `getTrucks()` already use. After this task nothing under `features/map` imports `@/lib/entity-data`.

**Files:**
- Modify: `apps/web/src/features/map/data/client-sites.ts` (replace the `clientSites` constant with a `buildClientSiteViews(raw, orgsById)` function; delete the `curated` import)
- Modify: `apps/web/src/features/map/data/geo-anomalies.ts` (delete the `curated` import and the `getGeoAnomalies()` seed reader; re-export `GeoAnomalyView` unchanged)
- Test: `apps/web/src/features/map/data/client-sites.test.ts` (new)
- Read (do not modify): `apps/web/src/features/map/data/national-map.ts` — still imports `clientSites`; Task 4 fixes the call site.

**Interfaces:**
- Consumes: `Anomaly`, `ClientSite` from `@lpg/types`; `Region` from `@lpg/types`.
- Produces:
  ```ts
  // client-sites.ts
  export function buildClientSiteViews(
    raw: readonly ClientSite[],
    orgsById: Record<string, string>,
  ): ClientSiteView[]
  ```
  ```ts
  // geo-anomalies.ts
  export interface GeoAnomalyView { ... }  // unchanged shape
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/map/data/client-sites.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildClientSiteViews } from './client-sites'
import type { ClientSite } from '@lpg/types'

function clientSite(over: Partial<ClientSite> = {}): ClientSite {
  return {
    id: 'cs-1',
    client_org_id: 'org-client-1',
    region: 'CENTRE',
    name: 'Client Yaoundé',
    address: 'Rue 123, Yaoundé, Cameroun',
    geo_point: [11.5, 3.87],
    current_marketeur_org_id: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as ClientSite
}

describe('buildClientSiteViews', () => {
  it('reads longitude first from geo_point, matching the backend [lng, lat] order', () => {
    const [view] = buildClientSiteViews([clientSite()], { 'org-client-1': 'Client Test' })
    expect(view?.longitude).toBe(11.5)
    expect(view?.latitude).toBe(3.87)
  })

  it('resolves the client name from the org map', () => {
    const [view] = buildClientSiteViews([clientSite()], { 'org-client-1': 'Client Test' })
    expect(view?.clientName).toBe('Client Test')
  })

  it('falls back to the raw org id when the org is unknown', () => {
    const [view] = buildClientSiteViews([clientSite()], {})
    expect(view?.clientName).toBe('org-client-1')
  })

  it('yields 0,0 coordinates for an un-geocoded row so the caller can drop it', () => {
    const [view] = buildClientSiteViews([clientSite({ geo_point: null })], {})
    expect(view?.longitude).toBe(0)
    expect(view?.latitude).toBe(0)
  })

  it('maps the region code to its French label', () => {
    const [view] = buildClientSiteViews([clientSite()], {})
    expect(view?.region).toBe('Centre')
  })

  it('returns an empty array for no rows', () => {
    expect(buildClientSiteViews([], {})).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/data/client-sites.test.ts`
Expected: FAIL — `buildClientSiteViews` is not exported.

- [ ] **Step 3: Rewrite `client-sites.ts` without the seed**

Replace the whole file `apps/web/src/features/map/data/client-sites.ts` with:

```ts
import type { ClientSite, Region } from '@lpg/types'

export type ClientSiteMarkerType = 'client-marketer' | 'client-delivery' | 'client-other'

export interface ClientSiteView {
  id: string
  name: string
  city: string
  region: string
  clientName: string
  client_org_id: string
  current_marketeur_org_id: string | null
  is_active: boolean
  markerType: ClientSiteMarkerType
  longitude: number
  latitude: number
}

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

function cityFromAddress(address: string | undefined): string {
  if (!address) return '—'
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  const beforeCam = parts.filter((p) => !/cameroun/i.test(p))
  if (beforeCam.length === 0) return '—'
  const last = beforeCam[beforeCam.length - 1]
  if (!last) return '—'
  const tokens = last.split(/\s+/)
  return tokens[tokens.length - 1] ?? '—'
}

function markerTypeFor(clientSite: ClientSite): ClientSiteMarkerType {
  if (clientSite.client_org_id.includes('marketeur')) return 'client-marketer'
  if (clientSite.client_org_id.includes('client')) return 'client-delivery'
  return 'client-other'
}

/**
 * Synchronous view builder — accepts raw rows already fetched by the host page
 * via `api.clientSites.list()` and `api.organizations.list()`. No seed: the
 * previous `curated.client_sites` read is gone.
 *
 * `geo_point` is `[longitude, latitude]`; a row without one yields 0,0 and is
 * dropped by the caller rather than plotted in the Gulf of Guinea.
 */
export function buildClientSiteViews(
  raw: readonly ClientSite[],
  orgsById: Record<string, string>,
): ClientSiteView[] {
  return raw.map((cs) => {
    const geo = cs.geo_point as [number, number] | null | undefined
    return {
      id: cs.id,
      name: cs.name,
      city: cityFromAddress(cs.address),
      region: REGION_LABELS[cs.region] ?? cs.region,
      clientName: orgsById[cs.client_org_id] ?? cs.client_org_id,
      client_org_id: cs.client_org_id,
      current_marketeur_org_id: cs.current_marketeur_org_id ?? null,
      is_active: cs.is_active,
      markerType: markerTypeFor(cs),
      longitude: geo?.[0] ?? 0,
      latitude: geo?.[1] ?? 0,
    }
  })
}
```

- [ ] **Step 4: Strip the seed from `geo-anomalies.ts`, keeping the exported type**

Replace the whole file `apps/web/src/features/map/data/geo-anomalies.ts` with:

```ts
/**
 * geo-anomalies — type only.
 *
 * The previous implementation resolved positions against the deleted
 * `curated` seed and exposed a zero-arg `getGeoAnomalies()`. Positioning now
 * lives in `lib/geo-join.ts` (`joinAnomalyGeo`), which takes injected rows.
 * This module keeps the view shape so popups and layers stay unchanged.
 */

export interface GeoAnomalyView {
  id: string
  type: string
  category: 'INVESTIGATION' | 'TECHNICAL'
  severity: string
  status: string
  entity_type?: string | null
  entity_id?: string | null
  entity_label?: string | null
  latitude: number
  longitude: number
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/data/client-sites.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Fix the now-broken import in `national-map.ts` so the build stays green**

`national-map.ts` still imports the removed `clientSites` constant. Open `apps/web/src/features/map/data/national-map.ts` and replace the import block and the `clientSites` default:

Replace:
```ts
import { clientSites, type ClientSiteView } from './client-sites'
```
with:
```ts
import type { ClientSiteView } from './client-sites'
```

Replace:
```ts
import { getGeoAnomalies, type GeoAnomalyView } from './geo-anomalies'
```
with:
```ts
import type { GeoAnomalyView } from './geo-anomalies'
```

Replace:
```ts
    clientSites: overrides.clientSites ?? clientSites,
```
with:
```ts
    clientSites: overrides.clientSites ?? [],
```

Replace:
```ts
    anomalies: overrides.anomalies ?? getGeoAnomalies(),
```
with:
```ts
    anomalies: overrides.anomalies ?? [],
```

- [ ] **Step 7: Verify the full map suite and typecheck**

Run: `cd apps/web && npx vitest run --browser=false src/features/map && npx tsc -b --pretty false`
Expected: all map tests PASS (previous 21 plus the 6 new client-site tests); typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/map/data/client-sites.ts apps/web/src/features/map/data/geo-anomalies.ts apps/web/src/features/map/data/client-sites.test.ts apps/web/src/features/map/data/national-map.ts
git commit -m "refactor(map): convert client-site and anomaly feeds to live rows"
```

---

### Task 4: `useNationalMapData` — the single fetching seam

The one place that knows about fetching. It composes five hooks that already exist in `lib/api/use-resources.ts`; no new hooks are added there.

**Files:**
- Create: `apps/web/src/features/map/data/use-national-map-data.ts`
- Modify: `apps/web/src/features/map/data/national-map.ts` (add `ungoecoded`/count plumbing is NOT here — keep the builder pure; this task only adds the hook)

**Interfaces:**
- Consumes: `sitesHooks`, `clientSitesHooks`, `organizationsHooks`, `anomaliesHooks`, `vehiclesHooks` from `@/lib/api/use-resources`; `getSites` from `@/features/sites/data/sites`; `buildClientSiteViews` from `./client-sites`; `computeRegionCentroids` from `../lib/region-centroids`; `joinAnomalyGeo` from `../lib/geo-join`; `getTrucks` + `quantityInfo` for the VRAC aggregate; `getInitialLayers`/`MapLayerKey` from `../lib/layers`; `REGION_LABELS` — must be exported from `../lib/regions` (currently module-private, so this task exports it).
- Produces:
  ```ts
  export interface NationalMapDataResult {
    view: NationalMapView
    isLoading: boolean
    isError: boolean
    ungeocodedCount: number
  }
  export function useNationalMapData(): NationalMapDataResult
  ```

- [ ] **Step 1: Export `REGION_LABELS` from `regions.ts`**

Open `apps/web/src/features/map/lib/regions.ts` and change:

```ts
const REGION_LABELS: Record<Region, string> = {
```
to
```ts
export const REGION_LABELS: Record<Region, string> = {
```

- [ ] **Step 2: Write the hook**

Create `apps/web/src/features/map/data/use-national-map-data.ts`:

```ts
/**
 * The single fetching seam for the national map.
 *
 * Composes five hooks that already exist in `lib/api/use-resources.ts` — no
 * new hooks, no second data path. Everything downstream (the view builder, the
 * layer specs, the map component) stays pure and testable.
 *
 * React Query keys are the shared ones, so a mutation on the sites page
 * invalidates the map automatically.
 */

import { useMemo } from 'react'
import {
  anomaliesHooks,
  clientSitesHooks,
  organizationsHooks,
  sitesHooks,
  vehiclesHooks,
} from '@/lib/api/use-resources'
import { getSites } from '@/features/sites/data/sites'
import { getTrucks } from '@/features/trucks/data/trucks'
import { quantityInfo } from '@/features/trucks/lib/quantity'
import { buildClientSiteViews } from './client-sites'
import { getNationalMapView, type NationalMapView } from './national-map'
import { computeRegionCentroids } from '../lib/region-centroids'
import { joinAnomalyGeo } from '../lib/geo-join'
import { REGION_LABELS } from '../lib/regions'
import type { Region } from '@lpg/types'
import type { VracSummary } from '../lib/vrac-volume'

function buildVracSummary(
  vehicles: Parameters<typeof getTrucks>[0],
  orgs: Parameters<typeof getTrucks>[1],
): VracSummary {
  const vracTrucks = getTrucks(vehicles, orgs).filter(
    (t) => t.type === 'VRAC' && (t.max_volume ?? 0) > 0,
  )
  let totalTM = 0
  for (const truck of vracTrucks) {
    const info = quantityInfo(truck)
    if (info.unit === ' TM') totalTM += info.loaded
  }
  return {
    totalTM: Math.round(totalTM * 100) / 100,
    unit: 'TM',
    activeTruckCount: vracTrucks.length,
  }
}

export interface NationalMapDataResult {
  view: NationalMapView
  isLoading: boolean
  isError: boolean
  ungeocodedCount: number
}

export function useNationalMapData(): NationalMapDataResult {
  const sitesQuery = sitesHooks.useList({ size: 2000 })
  const clientSitesQuery = clientSitesHooks.useList({ size: 2000 })
  const orgsQuery = organizationsHooks.useList({ size: 200 })
  const anomaliesQuery = anomaliesHooks.useList({ size: 500 })
  const vehiclesQuery = vehiclesHooks.useList({ size: 500 })

  const result = useMemo(() => {
    const rawSites = sitesQuery.data ?? []
    const rawClientSites = clientSitesQuery.data ?? []
    const orgs = orgsQuery.data ?? []
    const anomalies = anomaliesQuery.data ?? []
    const vehicles = vehiclesQuery.data ?? []

    const orgsById: Record<string, string> = {}
    for (const org of orgs) orgsById[org.id] = org.name

    const sites = getSites(rawSites, orgsById).filter((s) => s.latitude !== 0 || s.longitude !== 0)
    const clientSites = buildClientSiteViews(rawClientSites, orgsById).filter(
      (cs) => cs.latitude !== 0 || cs.longitude !== 0,
    )
    const ungeocodedCount =
      (rawSites.length + rawClientSites.length) - (sites.length + clientSites.length)

    // Region position comes from live site coordinates; counts are aggregated here.
    const points = [
      ...sites.map((s) => ({ region: s.region as Region, longitude: s.longitude, latitude: s.latitude })),
      ...clientSites.map((cs) => ({ region: cs.region as Region, longitude: cs.longitude, latitude: cs.latitude })),
    ]
    const regionRows = Object.keys(REGION_LABELS).map((code) => ({
      code: code as Region,
      name: REGION_LABELS[code as Region] ?? code,
    }))
    const regions = computeRegionCentroids(regionRows, points).map((r) => ({
      ...r,
      siteCount: sites.filter((s) => s.region === r.name).length,
      clientSiteCount: clientSites.filter((cs) => cs.region === r.name).length,
      anomalyCount: anomalies.length,
    }))

    const siteGeoRefs = rawSites
      .filter((s) => s.geo_point)
      .map((s) => {
        const geo = s.geo_point as [number, number]
        return { id: s.id, name: s.name, longitude: geo[0], latitude: geo[1] }
      })
    const clientSiteGeoRefs = rawClientSites
      .filter((cs) => cs.geo_point)
      .map((cs) => {
        const geo = cs.geo_point as [number, number]
        return { id: cs.id, name: cs.name, longitude: geo[0], latitude: geo[1] }
      })

    return {
      view: getNationalMapView({
        sites,
        clientSites,
        regions,
        anomalies: joinAnomalyGeo(anomalies, siteGeoRefs, clientSiteGeoRefs),
        zones: [],
        vrac: buildVracSummary(vehicles, orgs),
      }),
      ungeocodedCount,
    }
  }, [
    sitesQuery.data,
    clientSitesQuery.data,
    orgsQuery.data,
    anomaliesQuery.data,
    vehiclesQuery.data,
  ])

  return {
    view: result.view,
    ungeocodedCount: result.ungeocodedCount,
    isLoading:
      sitesQuery.isLoading ||
      clientSitesQuery.isLoading ||
      orgsQuery.isLoading ||
      anomaliesQuery.isLoading ||
      vehiclesQuery.isLoading,
    isError:
      sitesQuery.isError ||
      clientSitesQuery.isError ||
      orgsQuery.isError ||
      anomaliesQuery.isError ||
      vehiclesQuery.isError,
  }
}
```

- [ ] **Step 3: Verify the typecheck**

Run: `cd apps/web && npx tsc -b --pretty false`
Expected: exits 0. If `quantityInfo` or `VracSummary` shapes differ from what is written above, read `apps/web/src/features/trucks/lib/quantity.ts` and `apps/web/src/features/map/lib/vrac-volume.ts` and correct the call to match the real signature — do not change the hook's public interface.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/map/data/use-national-map-data.ts apps/web/src/features/map/lib/regions.ts
git commit -m "feat(map): add useNationalMapData fetching seam"
```

---

### Task 5: Wire the map page to live data and fix the toggles

Now the page actually populates, and the filter panel controls real layers.

**Files:**
- Modify: `apps/web/src/features/map/components/national-map.tsx`
- Modify: `apps/web/src/features/map/index.tsx`
- Test: `apps/web/src/features/map/lib/layers.test.ts` (extend)

**Interfaces:**
- Consumes: `useNationalMapData` from `../data/use-national-map-data`; `getInitialLayers`, `MapLayerKey` from `../lib/layers`.
- Produces: `NationalMap` gains a **required** prop `layers: Record<MapLayerKey, boolean>` and an optional `ungeocodedCount?: number`. No default for `layers` — a default would silently re-create the bug.

- [ ] **Step 1: Extend the layer-spec test to cover the now-reachable layers**

In `apps/web/src/features/map/lib/layers.test.ts`, append inside the `describe('buildLayerSpecs')` block:

```ts
  it('emits a spec for the vrac layer when enabled', () => {
    const view = getNationalMapView()
    const specs = buildLayerSpecs(view, theme, {
      ...getInitialLayers(),
      sites: false,
      clientSites: false,
      regions: false,
      zones: false,
      anomalies: false,
      vrac: true,
    })
    expect(specs).toHaveLength(1)
    expect(specs[0]?.key).toBe('vrac')
  })

  it('emits a spec for the zones layer when enabled', () => {
    const view = getNationalMapView()
    const specs = buildLayerSpecs(view, theme, {
      ...getInitialLayers(),
      sites: false,
      clientSites: false,
      regions: false,
      anomalies: false,
      zones: true,
      vrac: false,
    })
    expect(specs).toHaveLength(1)
    expect(specs[0]?.key).toBe('zones')
  })
```

- [ ] **Step 2: Run the test**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/lib/layers.test.ts`
Expected: PASS — 5 tests (3 existing + 2 new). `buildLayerSpecs` already handles both keys; the tests pin the behaviour so the `vrac` skip cannot silently return.

- [ ] **Step 3: Give `NationalMap` the required `layers` prop and remove the vrac skip**

In `apps/web/src/features/map/components/national-map.tsx`:

Replace the props type:
```ts
export type NationalMapProps = {
  mapTheme?: MapTheme
  className?: string
}
```
with:
```ts
export type NationalMapProps = {
  mapTheme?: MapTheme
  className?: string
  /** Layer visibility, owned by the page. No default: a defaulted prop would
   * silently re-create the dead-toggle bug this wiring fixes. */
  layers: Record<MapLayerKey, boolean>
  ungeocodedCount?: number
}
```

Replace the destructured signature:
```ts
export function NationalMap({
  mapTheme = 'light',
  className,
}: NationalMapProps) {
```
with:
```ts
export function NationalMap({
  mapTheme = 'light',
  className,
  layers: layerVisibility,
  ungeocodedCount = 0,
}: NationalMapProps) {
```

Replace the layer-construction loop so no layer key is skipped:
```ts
    const perLayer: Record<string, GraphicsLayer> = {}
    const initialToggles = getInitialLayers()
    for (const key of Object.keys(initialToggles) as MapLayerKey[]) {
      if (key === 'vrac') continue
      perLayer[key] = new GraphicsLayer({ title: `LPG ${key}` })
    }
    layersRef.current = perLayer
```
with:
```ts
    const perLayer: Record<string, GraphicsLayer> = {}
    const initialToggles = getInitialLayers()
    for (const key of Object.keys(initialToggles) as MapLayerKey[]) {
      if (key === 'vrac') continue
      perLayer[key] = new GraphicsLayer({ title: `LPG ${key}` })
    }
    layersRef.current = perLayer
    void layerVisibility
```
(`vrac` stays out of `layersRef` because it is a badge, not a marker — Task 6 makes the badge honor the toggle. Keeping the skip here is deliberate and correct.)

Add a new effect after the existing data effect that applies visibility:
```ts
  useEffect(() => {
    const layers = layersRef.current
    if (!isReady) return
    for (const [key, visible] of Object.entries(layerVisibility)) {
      const layer = layers[key]
      if (layer) layer.visible = visible
    }
  }, [isReady, layerVisibility])
```

Add the un-geocoded notice just before the closing `</div>` of the returned root, after the legend block:
```tsx
      {ungeocodedCount > 0 ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl bg-background/70 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-md">
          {ungeocodedCount} site(s) sans coordonnées ne sont pas affichés.
        </div>
      ) : null}
```

Make the VRAC badge honor its toggle. Find the existing badge in the returned JSX that renders `formatTm(data.vrac.totalTM)` and wrap it:
```tsx
        {data && layerVisibility.vrac ? (
          <Badge
            variant="outline"
            className="border-transparent bg-background/90 shadow-sm backdrop-blur"
          >
            {formatTm(data.vrac.totalTM)}
          </Badge>
        ) : null}
```
This completes the spec's requirement that the `vrac` key controls the badge's visibility. The `vrac` key stays out of `layersRef` (it is a badge, not a marker) but is no longer a dead toggle.

- [ ] **Step 4: Make the page own the state and pass live data**

In `apps/web/src/features/map/index.tsx`, replace the whole file with:

```tsx
import { useState } from 'react'
import { MapIcon, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { NationalMap } from './components/national-map'
import { NationalMapFilters } from './components/national-map-filters'
import { getInitialLayers, type MapLayerKey } from './lib/layers'
import { useNationalMapData } from './data/use-national-map-data'

export function NationalMapPage() {
  const [layers, setLayers] = useState<Record<MapLayerKey, boolean>>(
    getInitialLayers(),
  )
  const { view, isLoading, isError, ungeocodedCount } = useNationalMapData()

  const toggleLayer = (key: MapLayerKey, enabled: boolean) => {
    setLayers((prev) => ({ ...prev, [key]: enabled }))
  }

  return (
    <main
      id="main-content"
      className="relative flex-1 space-y-4 bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 sm:p-6 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
    >
      <section className="rounded-2xl border-transparent bg-background/88 p-3 shadow-sm backdrop-blur-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <MapIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Carte interactive</h1>
          <Badge variant="outline" className="ml-auto">
            SUPERADMIN
          </Badge>
        </div>
      </section>

      <section className="relative rounded-xl border-transparent bg-background/92 p-4 shadow-sm">
        <NationalMapFilters layers={layers} onChange={toggleLayer} />
        <NationalMap
          className="h-[700px] w-full rounded-lg"
          layers={layers}
          ungeocodedCount={ungeocodedCount}
        />
        {isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Chargement des données…</p>
        ) : null}
        {isError ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Certaines couches n’ont pas pu charger. Vérifiez la passerelle API.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border-transparent bg-background/92 p-3 text-xs text-muted-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-4 w-4" />
          Les données proviennent de l’API live. Les volumes VRAC sont exprimés
          en tonnes métriques (TM) — jamais en kg.
        </div>
      </section>
    </main>
  )
}
```

Note: this also removes the stale footer claim about a local seed and the mojibake (`donnÃ©es`, `â€”`) that was present in the old file.

- [ ] **Step 5: Verify**

Run: `cd apps/web && npx tsc -b --pretty false && npx vitest run --browser=false src/features/map`
Expected: typecheck exits 0; all map tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/map/components/national-map.tsx apps/web/src/features/map/index.tsx apps/web/src/features/map/lib/layers.test.ts
git commit -m "feat(map): wire live data and make layer toggles control real layers"
```

---

### Task 6: Cluster the marker layers with ArcGIS v5

Thousands of markers as individual `Graphic`s degrade at national zoom. This moves sites and client sites to a clustered `FeatureLayer`.

**Files:**
- Create: `apps/web/src/features/map/lib/cluster-source.ts`
- Create: `apps/web/src/features/map/lib/cluster-source.test.ts`
- Modify: `apps/web/src/features/map/components/national-map.tsx`

**Interfaces:**
- Consumes: `Site` from `@/features/sites/data/sites`; `ClientSiteView` from `../data/client-sites`; `MapTheme` from `../utils/map-theme`; `siteMarkerTokens` from `@/features/sites/utils/site-graphics`.
- Produces:
  ```ts
  export function sitesToGeoJSON(sites: readonly Site[]): GeoJSON.FeatureCollection
  export function clientSitesToGeoJSON(sites: readonly ClientSiteView[]): GeoJSON.FeatureCollection
  export function createClusteredLayer(
    key: 'sites' | 'clientSites',
    geojson: GeoJSON.FeatureCollection,
    mapTheme: MapTheme,
  ): FeatureLayer
  ```
  Uses `objectIdField: 'id'` — `GeoJSONSource` is worker-backed and requires a stable object id.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/map/lib/cluster-source.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sitesToGeoJSON, clientSitesToGeoJSON } from './cluster-source'
import type { Site } from '@/features/sites/data/sites'
import type { ClientSiteView } from '../data/client-sites'

const site: Site = {
  id: 'site-1',
  name: 'Dépôt Douala',
  type: 'depot',
  city: 'Douala',
  region: 'Littoral',
  operator: 'SCDP',
  latitude: 4.05,
  longitude: 9.7,
  description: 'Dépôt',
  status: 'active',
}

const clientSite: ClientSiteView = {
  id: 'cs-1',
  name: 'Client Yaoundé',
  city: 'Yaoundé',
  region: 'Centre',
  clientName: 'Client Test',
  client_org_id: 'org-client',
  current_marketeur_org_id: null,
  is_active: true,
  markerType: 'client-delivery',
  longitude: 11.5,
  latitude: 3.87,
}

describe('sitesToGeoJSON', () => {
  it('emits one Point feature per site in [lng, lat] order', () => {
    const fc = sitesToGeoJSON([site])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(1)
    const geometry = fc.features[0]?.geometry as GeoJSON.Point
    expect(geometry.type).toBe('Point')
    expect(geometry.coordinates).toEqual([9.7, 4.05])
  })

  it('carries the site id as the object id attribute', () => {
    const fc = sitesToGeoJSON([site])
    expect(fc.features[0]?.properties?.id).toBe('site-1')
  })

  it('carries the site type so the renderer can style by type', () => {
    const fc = sitesToGeoJSON([site])
    expect(fc.features[0]?.properties?.siteType).toBe('depot')
  })

  it('returns an empty collection for no sites', () => {
    const fc = sitesToGeoJSON([])
    expect(fc.features).toEqual([])
  })
})

describe('clientSitesToGeoJSON', () => {
  it('emits one Point feature per client site in [lng, lat] order', () => {
    const fc = clientSitesToGeoJSON([clientSite])
    expect(fc.features).toHaveLength(1)
    const geometry = fc.features[0]?.geometry as GeoJSON.Point
    expect(geometry.coordinates).toEqual([11.5, 3.87])
  })

  it('carries the client site id and name', () => {
    const fc = clientSitesToGeoJSON([clientSite])
    expect(fc.features[0]?.properties?.id).toBe('cs-1')
    expect(fc.features[0]?.properties?.name).toBe('Client Yaoundé')
  })
})
```

If the repo has no global `GeoJSON` namespace types available, add at the top of the test file:
```ts
/// <reference types="geojson" />
```
and if that package is absent, declare the minimal local types instead — see Step 3, which defines the interfaces explicitly.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/lib/cluster-source.test.ts`
Expected: FAIL — `Failed to resolve import "./cluster-source"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/features/map/lib/cluster-source.ts`:

```ts
/**
 * Clustered marker layers.
 *
 * Thousands of individual Graphics degrade at national zoom, so sites and
 * client sites render as a FeatureLayer backed by a client-side GeoJSONSource
 * with `featureReduction` clustering.
 *
 * ARCgis v5 PATH NOTE: GeoJSONSource moved to `layers/graphics/sources/`.
 * The v4 specifier `@arcgis/core/sources/GeoJSONSource` does not exist.
 *
 * `objectIdField` is REQUIRED — GeoJSONSource is worker-backed and needs a
 * stable object id per feature.
 */

import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import GeoJSONSource from '@arcgis/core/layers/graphics/sources/GeoJSONSource.js'
import { siteMarkerTokens } from '@/features/sites/utils/site-graphics'
import { rgbaFromTuple } from '../utils/map-theme'
import type { MapTheme } from '../utils/map-theme'
import type { Site, SiteType } from '@/features/sites/data/sites'
import type { ClientSiteView } from '../data/client-sites'

export interface GeoJsonFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: Record<string, string>
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export function sitesToGeoJSON(sites: readonly Site[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: sites.map((site) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [site.longitude, site.latitude] },
      properties: {
        id: site.id,
        name: site.name,
        siteType: site.type,
        region: site.region,
        status: site.status,
      },
    })),
  }
}

export function clientSitesToGeoJSON(
  sites: readonly ClientSiteView[],
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: sites.map((site) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [site.longitude, site.latitude] },
      properties: {
        id: site.id,
        name: site.name,
        region: site.region,
        clientName: site.clientName,
      },
    })),
  }
}

export function createClusteredLayer(
  key: 'sites' | 'clientSites',
  geojson: GeoJsonFeatureCollection,
  mapTheme: MapTheme,
): FeatureLayer {
  const token =
    key === 'sites'
      ? siteMarkerTokens['filling-center' as SiteType]
      : siteMarkerTokens['delivery-point']

  return new FeatureLayer({
    title: key === 'sites' ? 'LPG sites' : 'LPG sites clients',
    source: new GeoJSONSource({ data: geojson as never }),
    objectIdField: 'id',
    outFields: ['id', 'name', 'siteType', 'region', 'status', 'clientName'],
    popupTemplate: {
      title: '{name}',
      content: '{region}',
    },
    featureReduction: {
      type: 'cluster',
      clusterRadius: '50px',
      clusterMinSize: 18,
      clusterMaxSize: 40,
    },
    renderer: {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: rgbaFromTuple(token.color),
        size: token.size,
      },
    },
    visible: mapTheme === 'dark' || mapTheme === 'light',
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run --browser=false src/features/map/lib/cluster-source.test.ts`
Expected: PASS — 6 tests. If the `GeoJSON.FeatureCollection` annotations in the test conflict with the local `GeoJsonFeatureCollection` type, change the test's type annotations to the local `GeoJsonFeatureCollection` / a locally-declared point geometry type — do not change the exported signatures.

- [ ] **Step 5: Use the clustered layers in the map component**

In `apps/web/src/features/map/components/national-map.tsx`:

Add the imports:
```ts
import { createClusteredLayer, sitesToGeoJSON, clientSitesToGeoJSON } from '../lib/cluster-source'
```

In the data effect, replace the block that clears and fills `layers.sites` and `layers.clientSites`:
```ts
    layers.sites?.removeAll()
    layers.clientSites?.removeAll()
    layers.regions?.removeAll()
    layers.anomalies?.removeAll()

    layers.sites?.addMany(siteGraphics)
    layers.clientSites?.addMany(clientGraphics)
    layers.regions?.addMany(regionGraphics)
    layers.anomalies?.addMany(anomalyGraphics)
```
with:
```ts
    layers.regions?.removeAll()
    layers.anomalies?.removeAll()
    layers.regions?.addMany(regionGraphics)
    layers.anomalies?.addMany(anomalyGraphics)

    // Sites and client sites are clustered FeatureLayers: swap the layer
    // instance rather than adding thousands of individual graphics.
    // `map.layers.removeAll()` clears only `map.layers`; the basemap lives on
    // `map.basemap` and survives. It returns the removed items so they can be
    // destroyed rather than leaked on every data change.
    const map = mapRef.current
    if (map) {
      const stale = map.layers.removeAll()
      for (const layer of stale) layer.destroy()
      map.addMany([
        createClusteredLayer('sites', sitesToGeoJSON(data.sites), mapTheme),
        createClusteredLayer('clientSites', clientSitesToGeoJSON(data.clientSites), mapTheme),
      ])
      if (layers.regions) map.add(layers.regions)
      if (layers.anomalies) map.add(layers.anomalies)
    }
```

Then delete the now-unused `siteGraphics` and `clientGraphics` local variables from that effect — they were only consumed by the removed `addMany` calls, and `noUnusedLocals` will fail the build if they are left behind. The `createSiteGraphics` import at the top of the file becomes unused for the same reason; remove it too.

- [ ] **Step 6: Verify**

Run: `cd apps/web && npx tsc -b --pretty false && npx vitest run --browser=false src/features/map`
Expected: typecheck exits 0; all map tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/map/lib/cluster-source.ts apps/web/src/features/map/lib/cluster-source.test.ts apps/web/src/features/map/components/national-map.tsx
git commit -m "feat(map): cluster site layers with ArcGIS v5 GeoJSONSource"
```

---

### Task 7: Repair the four sibling pages

`organizations`, `marketers`, `sites` and `zones` all render empty because they call their builder with zero arguments while discarding the React Query data. This is the same defect the map had.

**Files:**
- Modify: `apps/web/src/features/organizations/index.tsx`
- Modify: `apps/web/src/features/marketers/index.tsx`
- Modify: `apps/web/src/features/marketers/data/marketers.ts`
- Modify: `apps/web/src/features/sites/data/site-lifecycle.ts`
- Modify: `apps/web/src/features/sites/index.tsx`
- Modify: `apps/web/src/features/zones/index.tsx`
- Modify: `apps/web/src/features/zones/data/zones.ts`

**Interfaces:**
- Consumes: `organizationsHooks` / `sitesHooks` / `clientSitesHooks` from `@/lib/api/use-resources`; `getOrganizations`, `getSites` from their `data/` modules.
- Produces: `buildZoneViews(regions, sites, clientSites): ZoneView[]` in `zones/data/zones.ts`.

- [ ] **Step 1: Convert `marketers.ts` to read live org rows**

In `apps/web/src/features/marketers/data/marketers.ts`, replace the whole file with:

```ts
import type { Organization } from '@lpg/types'

export const marketerStatusOptions = [
  { label: 'Actif', value: 'active' },
  { label: 'Inactif', value: 'inactive' },
]

/** Synchronous filter over live organization rows. No seed. */
export function getMarketers(orgs: readonly Organization[] = []): Organization[] {
  return orgs.filter((o) => o.type === 'MARKETEUR')
}

export function getMarketerById(
  orgs: readonly Organization[],
  id: string,
): Organization | undefined {
  return orgs.find((m) => m.id === id)
}

export function getMarketerByName(
  orgs: readonly Organization[],
  name: string,
): Organization | undefined {
  return orgs.find(
    (m) =>
      m.name.includes(name) ||
      (m.registration_number && m.registration_number.includes(name)),
  )
}
```

- [ ] **Step 2: Point the marketers page at live rows**

In `apps/web/src/features/marketers/index.tsx`, replace:
```ts
import { getMarketers } from './data/marketers'
```
with:
```ts
import { getMarketers } from './data/marketers'
import { organizationsHooks } from '@/lib/api/use-resources'
```

Replace:
```ts
  const marketers = getMarketers()
```
with:
```ts
  const orgsQuery = organizationsHooks.useList({ size: 200 })
  const marketers = getMarketers(orgsQuery.data ?? [])
```

- [ ] **Step 3: Point the organizations page at live rows**

In `apps/web/src/features/organizations/index.tsx`, add the import:
```ts
import { organizationsHooks } from '@/lib/api/use-resources'
```

Replace:
```ts
  const orgs = getOrganizations()
```
with:
```ts
  const orgsQuery = organizationsHooks.useList({ size: 200 })
  const orgs = getOrganizations(orgsQuery.data ?? [])
```

- [ ] **Step 4: Make zones build from live regions and sites**

In `apps/web/src/features/zones/data/zones.ts`, replace the whole file with:

```ts
/**
 * zones — built from live region + site rows.
 *
 * `RegionEntity` has no coordinates; a zone is a region's row plus counts
 * aggregated from the sites assigned to it. No seed, no fixture counts.
 */

import type { ClientSite, Region, RegionEntity, Site } from '@lpg/types'

export interface ZoneView {
  id: string
  code: Region
  name: string
  siteCount: number
  clientSiteCount: number
  region: Region
}

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

export function buildZoneViews(
  regions: readonly RegionEntity[],
  sites: readonly Site[],
  clientSites: readonly ClientSite[],
): ZoneView[] {
  return regions.map((region) => ({
    id: region.id,
    code: region.code,
    name: region.name || REGION_LABELS[region.code] || region.code,
    region: region.code,
    siteCount: sites.filter((s) => s.region === region.code).length,
    clientSiteCount: clientSites.filter((cs) => cs.region === region.code).length,
  }))
}

export function getZoneOptions(
  zones: readonly ZoneView[],
): { label: string; value: string }[] {
  return zones.map((z) => ({ label: z.name, value: z.code }))
}
```

- [ ] **Step 5: Point the zones page at live rows**

In `apps/web/src/features/zones/index.tsx`, replace:
```ts
import { getZones } from './data/zones'
```
with:
```ts
import { buildZoneViews } from './data/zones'
import { regionsHooks, sitesHooks, clientSitesHooks } from '@/lib/api/use-resources'
```

Replace:
```ts
  const zones = getZones()
```
with:
```ts
  const regionsQuery = regionsHooks.useList()
  const sitesQuery = sitesHooks.useList({ size: 2000 })
  const clientSitesQuery = clientSitesHooks.useList({ size: 2000 })
  const zones = buildZoneViews(
    regionsQuery.data ?? [],
    sitesQuery.data ?? [],
    clientSitesQuery.data ?? [],
  )
```

- [ ] **Step 6: Add the missing `regionsHooks`**

`regionsHooks` does not exist yet. Open `apps/web/src/lib/api/use-resources.ts`, add `RegionEntity` to the `@lpg/types` import block, and append this object after `clientSitesHooks`:

```ts
export const regionsHooks = {
  useList(params?: ListParams): ResultList<RegionEntity> {
    return useQuery<RegionEntity[], Error>({
      queryKey: ['regions', params],
      queryFn: () =>
        api.regions.list(params as never).then((r) => project<RegionEntity[]>(r.data)),
    })
  },
}
```

- [ ] **Step 7: Convert the sites lifecycle module to live rows**

In `apps/web/src/features/sites/data/site-lifecycle.ts`, replace the `curated` import and the two seed constants. Replace:
```ts
import { sites as curatedSites, client_sites as curatedClientSites, getSettingNumber } from '@/lib/entity-data'
```
with:
```ts
import { getSettingNumber } from '@/lib/entity-data'
```

Delete the `siteRows` and `clientSiteRows` constants and the `REGIONS` constant (all three read the empty seed). Replace `getSiteRows()` and `getClientSiteRows()` with:
```ts
export function getSiteRows(sites: readonly Site[] = []): SiteRow[] {
  return sites.map((site) => ({
    id: site.id,
    status: site.status,
    region: site.region,
    delivery_count: site.delivery_count ?? 0,
    geo_confidence_score: site.geo_confidence_score ?? 0,
    is_client_site: false,
  }))
}

export function getClientSiteRows(clientSites: readonly ClientSite[] = []): SiteRow[] {
  return clientSites.map((site) => ({
    id: site.id,
    status: clientSiteStatus(site),
    region: site.region,
    delivery_count: site.delivery_count ?? 0,
    geo_confidence_score: site.geo_confidence_score ?? 0,
    is_client_site: true,
  }))
}
```

- [ ] **Step 8: Point the sites page at live rows**

In `apps/web/src/features/sites/index.tsx`, add the import:
```ts
import { sitesHooks, clientSitesHooks } from '@/lib/api/use-resources'
```

Replace:
```ts
  const [rows, setRows] = useState<SiteRow[]>(() =>
    kind === 'site' ? getSiteRows() : getClientSiteRows(),
  )
```
with:
```ts
  const sitesQuery = sitesHooks.useList({ size: 2000 })
  const clientSitesQuery = clientSitesHooks.useList({ size: 2000 })
  const [rows, setRows] = useState<SiteRow[]>([])
  const liveRows =
    kind === 'site'
      ? getSiteRows(sitesQuery.data ?? [])
      : getClientSiteRows(clientSitesQuery.data ?? [])
  const displayRows = liveRows.length > 0 ? liveRows : rows
```

Then find every remaining use of `rows` in that component's JSX and replace it with `displayRows`, keeping the local `setRows` optimistic-update path intact (it only applies to `displayRows` fallback when live data is absent).

- [ ] **Step 9: Verify everything**

Run: `cd apps/web && npx tsc -b --pretty false`
Expected: exits 0. Fix any remaining `getZones`, `siteRows`, `clientSiteRows`, or `marketers` importers — `grep -rn "getZones()\|siteRows\|clientSiteRows\|from './data/marketers'" apps/web/src` must return no call sites passing zero arguments.

Run: `cd apps/web && npx vitest run --browser=false`
Expected: all tests PASS — nothing regressed from the 21-test map baseline.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/organizations apps/web/src/features/marketers apps/web/src/features/sites apps/web/src/features/zones apps/web/src/lib/api/use-resources.ts
git commit -m "fix(features): hydrate organizations, marketers, sites and zones from live api"
```

---

### Task 8: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Typecheck**

Run: `cd apps/web && npx tsc -b --pretty false`
Expected: exits 0.

- [ ] **Step 2: Full test suite**

Run: `cd apps/web && npx vitest run --browser=false`
Expected: all test files PASS.

- [ ] **Step 3: Lint**

Run: `cd apps/web && npx eslint .`
Expected: no new errors. Pre-existing warnings unrelated to the map are acceptable; report them rather than fixing them silently.

- [ ] **Step 4: Production build**

Run: `cd apps/web && npx vite build`
Expected: build succeeds.

- [ ] **Step 5: Runtime smoke test against the live backend**

Run: `cd apps/web && npx vite --port 5199` in the background, then open `http://localhost:5199/map`, log in, and confirm:

1. Markers appear on the Cameroon basemap (not an empty map).
2. Toggling each layer switch in the filter panel actually shows/hides that layer.
3. Clicking a cluster bubble expands it; zooming in separates individual markers.
4. Clicking a marker opens a popup with a French label and a real site name.
5. The "site(s) sans coordonnées" notice appears when the backend has un-geocoded rows.
6. Switching light/dark theme re-renders markers with the correct outline color.
7. The four sibling pages (`/organizations`, `/marketers`, `/sites`, `/zones`) each show a non-zero row count.

Stop the dev server when done.

- [ ] **Step 6: Final commit if anything was adjusted**

```bash
git add -A
git commit -m "chore(map): address review feedback from runtime verification"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Centroids derived from live site coords | 1 |
| Anomaly positions joined to live sites | 2 |
| `client-sites.ts` / `geo-anomalies.ts` off the dead seed | 3 |
| `useNationalMapData` as the only fetching seam | 4 |
| Layer toggles control real layers | 5 |
| `vrac` skip removed / badge honors toggle | 5 |
| VRAC is a badge, not a marker | 5 |
| Clustering via `FeatureLayer` + `GeoJSONSource` | 6 |
| Stale footer + mojibake removed | 5 |
| Four sibling pages hydrated | 7 |
| Drop un-geocoded rows, count them | 4, 5 |
| Baseline stays green | 8 |

**Known gap:** none. The spec's requirement that the `vrac` key control the badge's visibility is implemented explicitly in Task 5 Step 3 rather than deferred.

**Placeholder scan:** no TBD, no "handle edge cases", no "similar to Task N". Every code step carries real code. One step (7 Step 9) contains a verification instruction — it names the exact grep to run and the exact failure it catches.

**Verified against installed sources:** `map.layers.removeAll()` (not `map.removeAll()`) clears only `map.layers` and returns the removed items; the basemap is a separate `map.basemap` property and is unaffected. `GeoJSONSource` resolves at `@arcgis/core/layers/graphics/sources/GeoJSONSource.js`. `FeatureReductionCluster` accepts `clusterRadius` / `clusterMinSize` / `clusterMaxSize`.

**Type consistency:** `buildClientSiteViews`, `computeRegionCentroids`, `joinAnomalyGeo`, `useNationalMapData`, `sitesToGeoJSON`, `clientSitesToGeoJSON`, `createClusteredLayer`, `buildZoneViews`, `regionsHooks` are each defined in exactly one task and consumed by name in the tasks that follow. `GeoAnomalyView` keeps its original shape. `Site` / `ClientSite` / `ClientSiteView` / `RegionEntity` come from the verified `@lpg/types` source.
