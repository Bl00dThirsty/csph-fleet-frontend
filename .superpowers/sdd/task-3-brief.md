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

