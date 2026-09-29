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

