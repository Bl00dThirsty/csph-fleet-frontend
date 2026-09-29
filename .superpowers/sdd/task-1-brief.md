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

