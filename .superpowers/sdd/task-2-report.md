# Task 2 report — Anomaly positions joined to live sites

**Status:** DONE
**Commit:** `305d0ef` — `feat(map): join anomaly positions to live site rows`
**Branch:** `feat/map-live-wiring` (parent commit `826aec0`, Task 1)

## What I created

Exactly two files, both new, both transcribed faithfully from
`.superpowers/sdd/task-2-brief.md`:

1. `apps/web/src/features/map/lib/geo-join.ts` (53 lines)
   - `export interface SiteGeoRef { id, name, longitude, latitude }`
   - `export function joinAnomalyGeo(anomalies, sites, clientSites): GeoAnomalyView[]`
   - `GeoAnomalyView` is imported as a **type** from `../data/geo-anomalies`
     (not redeclared). `Anomaly` is imported as a type from `@lpg/types`.
   - Pure: two `import type` statements only — no React, no ArcGIS, no network,
     no data-module import, no mock data.
2. `apps/web/src/features/map/lib/geo-join.test.ts` (69 lines)
   - 6 tests. Fixture data (`sites`, `clientSites`, the `anomaly()` builder)
     lives only here.

No other file in the repo was modified. `lib/region-centroids.ts` (Task 1) and
`data/geo-anomalies.ts` (Task 3's target) were read only.

### Behaviour implemented

- `site_id` wins, then `client_site_id`.
- An anomaly resolving to neither is **dropped**, never emitted at 0,0
  (`const ref = site ?? clientSite; if (!ref) continue`).
- `Map.get()` results are handled as `T | undefined`; no non-null assertions.
- `entity_label` = resolved site name, falling back to `entity_id`, then `null`.

## Verification — commands and actual output

All commands run from `apps/web`. `--browser=false` used throughout
(vitest browser mode hits a sandbox EACCES port-bind error — environment
quirk, not a code defect).

### 1. New test file

```
cd apps/web && npx vitest run --browser=false src/features/map/lib/geo-join.test.ts
```

Step 2 (before the implementation existed) — failed as required:

```
 ❯ src/features/map/lib/geo-join.test.ts (0 test)
 FAIL  src/features/map/lib/geo-join.test.ts [ src/features/map/lib/geo-join.test.ts ]
Error: Cannot find module './geo-join' imported from
C:/.../src/features/map/lib/geo-join.test.ts
 ❯ src/features/map/lib/geo-join.test.ts:2:1

 Test Files  1 failed (1)
      Tests  no tests
```

Step 4 (after the implementation) — expected 6 PASS:

```
 RUN  v4.1.10 C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  302ms
```

### 2. Typecheck

```
cd apps/web && npx tsc -b --pretty false
```

No output, `EXIT=0`.

### 3. Full map feature suite

```
cd apps/web && npx vitest run --browser=false src/features/map
```

```
 RUN  v4.1.10 C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web

 Test Files  8 passed (8)
      Tests  32 passed (32)
   Duration  1.15s
```

32 = 26 pre-existing + 6 new. Nothing pre-existing broke.

## Commit

```
git add apps/web/src/features/map/lib/geo-join.ts apps/web/src/features/map/lib/geo-join.test.ts
git commit -m "feat(map): join anomaly positions to live site rows"
```

```
[feat/map-live-wiring 305d0ef] feat(map): join anomaly positions to live site rows
 2 files changed, 122 insertions(+)
 create mode 100644 apps/web/src/features/map/lib/geo-join.test.ts
 create mode 100644 apps/web/src/features/map/lib/geo-join.ts
```

No `git add -A`. The pre-existing modified files (`.superpowers/sdd/*`,
`docs/superpowers/plans/...`) are plan/brief artefacts owned outside this task
and were deliberately left uncommitted.

## Self-review findings

1. **Type compatibility verified, not assumed.** `GeoAnomalyView.category` is
   `'INVESTIGATION' | 'TECHNICAL'` and `Anomaly['category']` is
   `AnomalyCategory = 'INVESTIGATION' | 'TECHNICAL'` — identical, so
   `category: anomaly.category` assigns without a cast. `type`/`severity`/
   `status` widen to the view's `string` fields. `tsc -b` confirms.
2. **`entity_label: ref.name ?? anomaly.entity_id ?? null` has a dead
   fallback.** `SiteGeoRef.name` is a required `string`, so under `strict` the
   `??` right-hand side is unreachable — TS narrows `ref.name` to `string`
   before the `??`. It is harmless and type-safe, and the brief specifies this
   fallback as the contract, so I transcribed it verbatim rather than
   "simplifying" it. Flagging only so Task 3's caller is not surprised if a
   site row ever arrives with a null/empty name: the fallback will not fire
   for `null` (the type forbids it) but *will* surface as an empty string.
3. **`if (!ref) continue` also drops a hypothetical `undefined` name row** —
   not reachable given the type, but the guard is the correct defensive shape
   and is what enforces the "never emit at 0,0" rule.
4. **Duplicate ids in the injected rows**: `new Map(rows.map(...))` keeps the
   last occurrence. No test covers this; acceptable for a lookup join and out
   of this task's scope.
5. **Line endings.** New files were written LF by the editor tool and then
   normalised to **CRLF, no BOM** via an explicit UTF-8 pass, matching
   `region-centroids.ts`, `vrac-volume.test.ts` and the rest of
   `features/map/lib`.
6. **Import graph.** `grep` for `geo-join` across `apps/web/src` matches only
   its own test — nothing in the repo imports the module yet, as expected for
   Task 2.

## Deviations from the brief

None. Test and implementation code are transcribed verbatim; the only
mechanical addition was the CRLF normalisation described in finding 5.

---

# Task 2 follow-up — `site_id` precedence coverage

Code review of 305d0ef found the module's most load-bearing rule unprotected:
`const ref = site ?? clientSite` encodes "`site_id` wins over `client_site_id`",
but no existing test sets **both** ids non-null. The default fixture has
`client_site_id: null`, the client-site test has `site_id: null`, and the
ghost-site test has `client_site_id: null` — so an implementation with the
precedence **reversed** passes all 6 original tests.

Two tests added. No existing test changed; `geo-join.ts` untouched.

## Tests added

```ts
  it('prefers site_id over client_site_id when both are set', () => {
    const result = joinAnomalyGeo(
      [anomaly({ site_id: 'site-1', client_site_id: 'cs-1' })],
      sites,
      clientSites,
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.longitude).toBe(9.7)
    expect(result[0]?.latitude).toBe(4.05)
    expect(result[0]?.entity_label).toBe('Dépôt Douala')
  })

  it('falls through to client_site_id when site_id does not resolve', () => {
    const result = joinAnomalyGeo(
      [anomaly({ site_id: 'ghost', client_site_id: 'cs-1' })],
      sites,
      clientSites,
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.longitude).toBe(11.5)
    expect(result[0]?.latitude).toBe(3.87)
    expect(result[0]?.entity_label).toBe('Client Yaoundé')
  })
```

Diff: `1 file changed, 24 insertions(+)`. The two fixtures differ in **all three**
asserted fields, so a wrong-precedence failure is unambiguous on coordinates and
on label independently — the label assertion is not a restatement of the coords.

## Verification

### 1. Targeted file — 6 + 2 = 8

```
cd apps/web && npx vitest run --browser=false src/features/map/lib/geo-join.test.ts
```

```
 RUN  v4.1.10 C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  10:34:25
   Duration  253ms (transform 34ms, setup 0ms, import 53ms, tests 6ms, environment 0ms)
```

### 2. Typecheck

```
cd apps/web && npx tsc -b --pretty false
```

```
tsc exit: 0
```

No diagnostics.

### 3. Full map feature suite — 32 + 2 = 34

```
cd apps/web && npx vitest run --browser=false src/features/map
```

```
 RUN  v4.1.10 C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web

 Test Files  8 passed (8)
      Tests  34 passed (34)
   Start at  10:35:01
   Duration  1.20s (transform 1.05s, setup 0ms, import 2.64s, tests 65ms, environment 4ms)
```

Nothing pre-existing broke. All runs use `--browser=false`; browser mode
port-binding fails with EACCES in this sandbox (environment, not code).

## Does the precedence test actually bite? — Yes

Verified by evaluating the variants against the real fixtures in a scratch
`node -e` (no repo file mutated, nothing committed):

| case | A: `site ?? clientSite` (current) | B: `clientSite ?? site` (reversed) | C: `if (site) … else if (clientSite)` | D: drop-if-site_id-set |
|---|---|---|---|---|
| both set | 9.7 / 4.05 / Dépôt Douala | **11.5 / 3.87 / Client Yaoundé** | 9.7 / 4.05 / Dépôt Douala | 9.7 / 4.05 / Dépôt Douala |
| site miss | 11.5 / 3.87 / Client Yaoundé | 11.5 / 3.87 / Client Yaoundé | 11.5 / 3.87 / Client Yaoundé | **DROPPED** |

**B fails the new precedence test on all three assertions** and is the *only*
variant the new test distinguishes. Before this change B was indistinguishable
from A across the whole suite — the gap the review flagged is now closed.

**One correction to the brief.** It predicted the second test would catch a naive
`if (site) {…} else if (clientSite) {…}` rewrite (variant C). Column C shows
that rewrite is **behaviourally identical** to `site ?? clientSite` for this
function: when the site misses, `if (site)` is false and control reaches
`clientSite`; when both miss, neither branch fires and the row is dropped, the
same as `if (!ref) continue`. So the second test does not catch C.

It does catch D — a rewrite that early-returns on a set-but-unresolvable
`site_id` — which silently drops the anomaly instead of falling through to its
client site. That is a real regression class and the test is worth keeping, but
it is D, not C, that it guards. Flagging so the contract is recorded accurately.

## Commit

```
git add apps/web/src/features/map/lib/geo-join.test.ts
git commit -m "test(map): cover site_id precedence in anomaly geo join"
```

```
[feat/map-live-wiring 5747ee4] test(map): cover site_id precedence in anomaly geo join
 1 file changed, 24 insertions(+)
```

No `git add -A`. The other modified files in the tree (`.superpowers/sdd/*`,
`docs/superpowers/plans/...`, the `*-columns.tsx` set, the deleted
`components/data-table/*` and `date-picker.tsx`) and the untracked
`apps/web/src/lib/table-filters.*` are outside this task and were left alone.

## Line endings

`CRLF=93 bareLF=0`, no BOM — the editor preserved the CRLF convention finding 5
established, so no re-normalisation pass was needed.
