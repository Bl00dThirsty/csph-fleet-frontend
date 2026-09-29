# Subagent-Driven Development Progress Ledger

Branch: `feat/map-live-wiring`
Plan: `docs/superpowers/plans/2026-09-29-national-map-live-wiring.md`
Spec: `docs/superpowers/specs/2026-09-29-national-map-live-wiring-design.md`

(Replaces a stale ledger from an unrelated 2026-08-10 plan whose file no longer exists.)

## Baseline

- Branch created from `main` at `78a1b18` (spec) / `a7e7492` (plan).
- `npx tsc -b` exits 0.
- `npx vitest run --browser=false src/features/map` → 6 files, 21 tests pass.
- `VITE_ARCGIS_API_KEY` present in `apps/web/.env`.

## Tasks

- [x] Task 1: complete (commit 826aec0, review clean — spec ✅, quality Approved)
- [x] Task 2: complete (commits 305d0ef + 5747ee4, review clean after one Important
  test-coverage fix: site_id precedence was unprotected)
- [ ] Task 3: convert `client-sites.ts` / `geo-anomalies.ts` off the dead seed
- [ ] Task 4: `useNationalMapData` fetching seam
- [ ] Task 5: wire live data + real layer toggles
- [ ] Task 6: ArcGIS v5 clustered marker layers
- [ ] Task 7: repair the four sibling pages
- [ ] Task 8: full verification (typecheck, test, lint, build, runtime smoke)

## Environment notes

- Run all commands from `apps/web`.
- vitest browser mode fails in this sandbox with an EACCES port bind. Use
  `npx vitest run --browser=false <path>` — the default `pnpm test` script already
  passes `--browser=false`.
- `docs/superpowers/` is gitignored but prior specs/plans are tracked; add new
  files with `git add -f`.

## Verified API facts (do not re-derive)

- `@arcgis/core` is **5.1.14**. `GeoJSONSource` is at
  `@arcgis/core/layers/graphics/sources/GeoJSONSource.js` — the v4 path
  `@arcgis/core/sources/GeoJSONSource` does not exist.
- `FeatureReductionCluster` accepts `clusterRadius`, `clusterMinSize`, `clusterMaxSize`.
- `GeoJSONSource` is worker-backed and **requires** a stable `objectIdField`.
- `map.layers.removeAll()` clears only `map.layers` and returns removed items;
  the basemap is the separate `map.basemap` property and is unaffected.
- `RegionEntity` = `{ id, name, code, created_at, updated_at }` — no coordinates.
- `Site.geo_point` / `ClientSite.geo_point` are `[lng, lat]`, frequently null.
- View builders return a **French region label** (`"Centre"`), not the code
  (`"CENTRE"`). Region aggregation must read the code off raw rows.

## Pre-flight findings (fixed in the plan before dispatch)

- Task 4 originally derived centroids from view rows, whose `region` is a label
  rather than a code — that would have dropped every region. Corrected to read
  region codes off the raw rows.
- Task 6 originally called `map.removeAll()`; the correct API is
  `map.layers.removeAll()`. Corrected, including destroying the removed layers.
- Task 5 originally left the VRAC badge always visible, contradicting the spec.
  Corrected to honor the `vrac` toggle.
- Carried-forward minor from the earlier ledger: `features/sites/utils/site-graphics.ts`
  duplicates `getLpgMarkerIcon` / `getSiteIconUrl` / `getSiteOutlineColor` /
  `svgToDataUri` from `features/map/utils/map-theme.ts`. Out of scope; flagged for
  a later dedup pass.

## ⚠️ CONCURRENT FOREIGN WORK IN THE WORKING TREE

A **separate workstream** (not this session) is mid-edit in the same working tree,
uncommitted: a data-table faceted-filter refactor touching ~12 features. Observed:

- Deleted: `components/data-table/faceted-filter.tsx`, `components/data-table/main.tsx`,
  `components/data-table/view-options.tsx`, `components/date-picker.tsx`
- New: `apps/web/src/lib/table-filters.ts` + `.test.ts`
- Modified: all `*-columns.tsx` across devices/drivers/marketers/recompute/rfid-tags/
  supply/transporters/trucks/users/vehicles, plus `features/sites/index.tsx`
  and `features/sites/data/sites-crud.ts`

It typechecks clean (verified `tsc -p tsconfig.app.json --noEmit` → exit 0), so it is
internally consistent mid-refactor, not broken.

**Impact on this plan:**

- Tasks 1–6 touch only `features/map/**` — **no overlap, safe to continue.**
- **Task 7 CONFLICTS**: it must edit `features/sites/index.tsx`, which the foreign
  workstream is actively rewriting. Do NOT dispatch Task 7 until the human decides.
- `lib/api/use-resources.ts` is NOT touched by the foreign work — safe.

**Rules for every implementer dispatch from here on:**

1. Never use `git add -A` or `git add .` — stage ONLY the files named in the brief.
2. Never revert, stash, or reformat a file that is not in the brief.
3. If a brief-named file has foreign modifications, report it and stop rather than
   overwriting.

## Minor findings (carried forward)

From the Task 1 review (all non-blocking, none change the Task 1 code):

- **MUST be handled in Task 4:** `region-centroids.ts` does not guard against
  non-finite or malformed `geo_point` values. `Site.geo_point` is typed
  `number[] | [number, number] | null`, so a malformed row carrying `NaN` would
  place a `NaN` marker. The filter belongs at the call site: Task 4's `geoOf`
  helper must require `Number.isFinite` on both components before use.
- `region-centroids.ts:45` — `acc.count === 0` is unreachable defensive code
  (counts only initialise to 1 or increment). Harmless; noted so it is not later
  misread as a handled case.
- `region-centroids.ts` — the doc comment does not state that `regions` must
  contain at most one entry per code; duplicate codes emit duplicate summaries.
  Task 4 builds `regionRows` from `Object.keys(REGION_LABELS)`, so it is safe by
  construction.
- Test coverage gap: no case for duplicate region codes, an unknown region code in
  `points`, a 3+ point mean, or input non-mutation. All are behaviours Task 4
  depends on.
- Report inaccuracy (not a code defect): the Task 1 report claimed the committed
  blobs are LF-normalised. They are CRLF in the commit, like every sibling file.
  The outcome (consistency with the repo) is correct; do not "fix" the EOLs.
