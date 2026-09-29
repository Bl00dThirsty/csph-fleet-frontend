# National Map — Live Data Wiring

**Date:** 2026-09-29
**Status:** Design approved, ready for implementation plan
**Scope:** `features/map` + `features/sites` + `features/marketers` + `features/organizations` + `features/zones`

## Problem

The national map renders correctly but plots **zero markers**. The ArcGIS view boots,
the basemap draws, popups and theme switching all work — every layer is fed from an
empty array.

The cause is commit `2887fcf` ("remove the mock-data layer and rewire feature data to
the live api"). That commit correctly deleted the fixtures and converted the view
builders to accept live rows, but the second half of the job — actually calling those
builders with fetched data — never landed. `lib/entity-data.ts` states the situation
directly: every collection is `[]` and "must stay that way".

The map is the most visible symptom. The defect is systemic.

### Verified defects

1. **The filter panel is wired to nothing.** `features/map/index.tsx:9` holds
   `Record<MapLayerKey, boolean>` state and passes it to `NationalMapFilters`.
   `NationalMap` never accepts it as a prop — it calls `getInitialLayers()` internally
   at `components/national-map.tsx:62` and ignores the toggles. The switches animate;
   no layer changes. `lib/layers.ts` exports `buildLayerSpecs()`, imported by no file.

2. **Two layers are unreachable by construction.** `national-map.tsx:64` runs
   `if (key === 'vrac') continue`, so no `GraphicsLayer` is ever created for VRAC.
   `zones` gets a layer created but is never populated.

3. **Region coordinates are hardcoded to `0,0`.** `lib/regions.ts` returns
   `longitude: 0, latitude: 0` and `regionsForMap()` returns `[]`. `RegionEntity` in
   `@lpg/types` has no coordinate fields at all, so region positions cannot come from
   `api.regions.list()`.

4. **Two feeds still read the dead seed.** `map/data/client-sites.ts:1` and
   `map/data/geo-anomalies.ts:1` import `curated` from the emptied module.

5. **Every sibling page has the same defect.** `getOrganizations()`,
   `getMarketers()`, `getZones()`, `getTrucks()`, `getPickups()` are all called with
   zero arguments, so each defaults to `[]`. `useEntityCrud` already fires the correct
   `api.*.list()` React Query, but each page **discards `crud.list.data`** and renders
   the empty fallback. `features/organizations/data/organizations.ts` even exports an
   unused `fetchOrganizations()`.

### What is already correct and must be preserved

- The ArcGIS render pipeline: view lifecycle, basemap/theme switching, hit-testing,
  popup templates, legend, badges, error and no-key states.
- `getSites(raw, orgsById)`, `getTrucks(vehicles, orgs)`, `getOrganizations(raw)` were
  all correctly converted to accept live rows.
- `lib/api/use-resources.ts` already exports typed `sitesHooks`, `clientSitesHooks`,
  `anomaliesHooks`, `organizationsHooks`, `vehiclesHooks`.
- `map/utils/popup.tsx` and `sites/utils/site-graphics.ts` are complete and reusable.
- `VITE_ARCGIS_API_KEY` is present (254 chars) in `apps/web/.env`.

## Environment constraints (verified)

- `@arcgis/core` **5.1.14** installed (declared `^5.0.18`).
- In v5, **`sources/` moved to `layers/graphics/sources/`**. The v4 import path
  `@arcgis/core/sources/GeoJSONSource` does not exist. The correct specifier is
  `@arcgis/core/layers/graphics/sources/GeoJSONSource.js`. This is load-bearing for
  clustering.
- `FeatureReductionLayer` mixin is present and typed — `featureReduction` with
  `FeatureReductionCluster` is supported on `FeatureLayer`.
- `GeoJSONSource` is available, so **client-side clustering needs no backend feature
  service**.
- `RegionEntity` = `{ id, name, code, created_at, updated_at }`. No geometry.
- `Site.geo_point` and `ClientSite.geo_point` are `[lng, lat]`, frequently `null`.
- Baseline `npx tsc -b` exits 0.
- `tsconfig.app.json`: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns`, `skipLibCheck`.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Region geometry | Derive centroids from live site coordinates | Zero new backend work, 100% real data, no hardcoded geography (AGENTS.md §4 forbids invented coordinates) |
| Scope | One shared data path — map **and** 4 sibling pages | Single canonical location per concept; no forked data path |
| Marker volume | Clustering (FeatureLayer + featureReduction) | Thousands of markers; plain GraphicsLayer degrades at national zoom |
| Trucks map | **Out of scope** | Separate follow-up; see Out of scope |

## Architecture

### Layer 1 — Data (pure, testable, no React)

`features/map/data/national-map.ts` stays a **pure builder**. `getNationalMapView()`
keeps its zero-arg empty defaults — that is the correct pre-hydration state per
AGENTS.md §4 ("views render empty until their store hydrates"). It gains the ability
to accept live rows.

New `features/map/lib/region-centroids.ts`:

```ts
export function computeRegionCentroids(
  regions: readonly RegionEntity[],
  sites: readonly { region: Region; longitude: number; latitude: number }[],
  clientSites: readonly { region: Region; longitude: number; latitude: number }[],
): RegionSummary[]
```

Averages the `geo_point` of each region's sites and client sites. A region with no
geocoded rows is **omitted entirely** rather than placed at `0,0`.

New `features/map/lib/geo-join.ts`: resolves anomaly positions by joining
`site_id` / `client_site_id` against the live site sets — the logic that already exists
in `geo-anomalies.ts`, but parameterized over injected rows instead of the dead seed.

`features/map/data/client-sites.ts` and `geo-anomalies.ts` are converted from
module-level constants over `curated` to functions accepting raw rows, matching the
shape `getSites()` / `getTrucks()` already use.

### Layer 2 — Hooks (the only place that knows about fetching)

New `features/map/data/use-national-map-data.ts`:

```ts
export function useNationalMapData(): {
  view: NationalMapView
  isLoading: boolean
  isError: boolean
  ungeocodedCount: number
}
```

Composes the five **existing** hooks from `lib/api/use-resources.ts`. It is the single
place that knows about fetching; the view builder stays pure. React Query keys stay
consistent across all consumers, so a mutation on the sites page invalidates the map.

No new hooks are added to `use-resources.ts` — the five required ones already exist.

### Layer 3 — Presentation

`NationalMap` gains a **required** `layers: Record<MapLayerKey, boolean>` prop — no
default. A default would silently re-create the current bug (toggles that render but
do nothing), so the compiler enforces that every call site supplies real state.
`index.tsx` already owns that state and keeps it. Toggling sets `layer.visible` on the
corresponding ArcGIS layer. The internal `getInitialLayers()` call and the
`if (key === 'vrac') continue` skip are both removed; `getInitialLayers()` survives as
the single default-value source for `index.tsx`'s `useState` initializer.

**VRAC is a badge, not a marker.** It has no geographic position of its own — it is an
aggregate of loaded volume across VRAC trucks, currently already rendered as a
`formatTm(data.vrac.totalTM)` badge in the overlay. The `vrac` key therefore stays in
`MapLayerKey` and controls that badge's visibility, rather than creating a marker with
no defensible location. `buildVracPopupContent` is retained for the summary panel.

`lib/layers.ts` `buildLayerSpecs()` becomes the single definition of every layer
(visibility, renderer, popup builder), removing the duplicated knowledge currently
split between `layers.ts` and `national-map.tsx`.

**Clustering.** Sites and client sites move to `FeatureLayer` + `GeoJSONSource`
(`@arcgis/core/layers/graphics/sources/GeoJSONSource.js` — the v5 path) with
`featureReduction: { type: 'cluster' }`. Anomalies stay on `GraphicsLayer` — low
volume, and clustering would obscure a critical signal. Regions use `GraphicsLayer`
with derived centroids.

`index.tsx` also loses its stale footer text claiming data comes from a local seed
(it currently also has mojibake: `donnÃ©es`, `â€”`).

### Layer 4 — Sibling pages

`organizations`, `marketers`, `sites`, `zones` consume their React Query hook data
instead of calling the zero-arg builder. `marketers.ts` stops importing `curated`;
it filters `type === 'MARKETEUR'` from live org rows.

## Data flow

```
api.sites.list()          ─┐
api.clientSites.list()     │
api.organizations.list()   ├─→ useNationalMapData()  ─→ NationalMapView (pure)
api.anomalies.list()       │        │
api.vehicles.list()       ─┘        ├─→ region centroids (derived)
                                    └─→ anomaly geo join
                                             │
                                             ↓
                        FeatureLayer(sites) ── clustered
                        FeatureLayer(clientSites) ── clustered
                        GraphicsLayer(anomalies)
                        GraphicsLayer(regions, derived)
                        GraphicsLayer(vrac summary)
                                             │
                                             ↓
                        layers.visible ← index.tsx toggle state
```

## Error handling

- A failed query leaves its layer empty; other layers still render. The map shows the
  existing ArcGIS error banner, plus a per-layer failure notice.
- `ungeocodedCount` is surfaced in the UI: rows with `geo_point === null` are dropped
  from the map and counted, never plotted at `0,0`.
- A region whose sites are all un-geocoded is omitted, not zero-placed.
- Empty state (all queries resolved, zero rows) renders an explicit "no geocoded data"
  message rather than a blank Cameroon.

## Testing

Pure logic is unit-tested beside itself per AGENTS.md §3 (`lib/*.test.ts`):

- `region-centroids.test.ts` — correct averaging, omission of empty regions, no
  division by zero, `noUncheckedIndexedAccess`-safe indexing.
- `geo-join.test.ts` — anomaly resolves via `site_id`, via `client_site_id`, unresolvable
  anomaly is dropped.
- `national-map.test.ts` — extend the existing suite; keep the "defaults to empty"
  assertion (it documents the pre-hydration contract) and add a populated case.
- `layers.test.ts` — extend to cover VRAC and zones now that both are reachable.

Existing tests must keep passing. `npx tsc -b` must exit 0.

## Out of scope

- **`features/trucks/components/trucks-map.tsx`** — a second, separate ArcGIS
  implementation (~16KB) duplicating basemap, theme, and popup logic. It also receives
  a hardcoded `sites={[]}` from `features/trucks/index.tsx:201`. Worth consolidating
  into one canonical renderer, but that is a deliberate follow-up, not a side effect
  of this work.
- Backend schema changes (region coordinates, a GeoJSON feature service).
- Live vehicle GPS tracking / animated tours on the national map.
- The `pickups` and `pickup-tracking` features, which share defect 5 but are not map
  inputs.

## Risks

| Risk | Mitigation |
|---|---|
| Touching 5 features on a clean `main` | Branch before starting: `feat/map-live-wiring` |
| GeoJSON serialization cost for thousands of markers | Build GeoJSON once per query result via `useMemo`; `featureReduction` handles render load |
| Popup HTML built as strings | `escapePopupValue` already applied in `popup.tsx`; preserve it |
| Clustering hides individual anomalies | Anomalies deliberately stay unclustered on `GraphicsLayer` |
