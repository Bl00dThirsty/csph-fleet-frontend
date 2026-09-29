# Task 1 Report — Region centroids derived from live site coordinates

**Status:** DONE
**Branch:** `feat/map-live-wiring`
**Commit:** `826aec05f6fe30658886bf95bf877c54e99e2c46`
**Commit message:** `feat(map): derive region centroids from live site coordinates`

---

## What I created

Two new files, both transcribed verbatim from `.superpowers/sdd/task-1-brief.md`:

| File | Purpose |
|---|---|
| `apps/web/src/features/map/lib/region-centroids.ts` (57 lines) | Pure module exporting `GeoPoint` and `computeRegionCentroids(regions, points): RegionSummary[]` |
| `apps/web/src/features/map/lib/region-centroids.test.ts` (55 lines) | 5 unit tests, transcribed as the specification |

No other file was created, modified, or deleted. `apps/web/src/features/map/lib/regions.ts` was read only
(confirmed it exports `RegionSummary`, and that `REGION_LABELS` is module-private as the brief stated).

### Behaviour implemented
- Averages `longitude` / `latitude` of all points belonging to a region → its centroid.
- A region with **zero** geocoded points is **omitted entirely** — never emitted at `0,0`
  (AGENTS.md §4: "no invented fallback values … coordinates").
- `siteCount`, `clientSiteCount`, `anomalyCount` are returned as `0`. This is intentional and documented
  in the file's doc comment: **this function owns position only**; Task 4 overwrites the counts.
  I did not "improve" this by computing counts from `points`.
- Output order follows the order of the `regions` input array, not the order of `points`.
- No extra exports, no renamed symbols, no changed signatures.

### Constraint compliance
- **Pure:** no React, no ArcGIS, no network, no store access. Only `import type` from `@lpg/types`
  and `./regions`; both are erased at compile time, so the module pulls in no runtime dependency
  (notably, `regions.ts` imports the empty `getZones()` seed — that import is elided because
  `RegionSummary` is a type-only import).
- **No mock/demo data in app code:** all test inputs live in the test file only.
- **Conventions:** `AGENTS.md` §3 requires colocated tests in `lib/*.test.ts` — satisfied.
  The brief's doc comment references `AGENTS.md §4`; I verified §4 exists ("Business rules &
  system conventions") and does contain the no-invented-coordinates rule, so the reference is accurate.
- **Language:** doc comment kept in English as given; no user-facing strings added.
- **Strict TS:** satisfied under `noUncheckedIndexedAccess` — the `Map.get()` `| undefined` is
  handled via the `if (acc)` / `if (!acc || acc.count === 0) continue` guards, exactly as in the brief.

---

## Commands run and actual output

### 0. Step 2 — red test before implementing (TDD, per brief)

```
cd apps/web && npx vitest run --browser=false src/features/map/lib/region-centroids.test.ts
```

```
 RUN  v4.1.10 C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web

 ❯ src/features/map/lib/region-centroids.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/features/map/lib/region-centroids.test.ts [ src/features/map/lib/region-centroids.test.ts ]
Error: Cannot find module './region-centroids' imported from
C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web/src/features/map/lib/region-centroids.test.ts
 ❯ src/features/map/lib/region-centroids.test.ts:2:1
      1| import { describe, it, expect } from 'vitest'
      2| import { computeRegionCentroids } from './region-centroids'
       | | ^
      3| import type { Region } from '@lpg/types'
       | |

 Test Files  1 failed (1)
      Tests  no tests
   Start at  10:13:53
   Duration  278ms (transform 26ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)
```

Failed for the correct reason (module does not exist yet), as the brief predicted.

### 1. Required verification — new test file

```
cd apps/web && npx vitest run --browser=false src/features/map/lib/region-centroids.test.ts
```

```
 RUN  v4.1.10 C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web


 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  10:14:28
   Duration  372ms (transform 42ms, setup 0ms, import 66ms, tests 6ms, environment 0ms)

EXITCODE=0
```

5 tests PASS — matches expectation.

### 2. Required verification — typecheck

```
cd apps/web && npx tsc -b --pretty false
```

```
EXITCODE=0
```

No diagnostics, exit code 0 — matches expectation.

### 3. Required verification — whole map feature suite (regression guard)

```
cd apps/web && npx vitest run --browser=false src/features/map
```

```
 RUN  v4.1.10 C:/Users/DTA_WorkStation/Documents/CSPH/csph-fleet-frontend/apps/web


 Test Files  7 passed (7)
      Tests  26 passed (26)
   Start at  10:15:05
   Duration  986ms (transform 637ms, setup 0ms, import 1.86s, tests 43ms, environment 3ms)

EXITCODE=0
```

26 total = the pre-existing 21 plus my 5, across 7 files. **Nothing pre-existing broke.**

### 4. Extra check (not required, run for proportionality) — lint

```
cd apps/web && npx eslint src/features/map/lib/region-centroids.ts src/features/map/lib/region-centroids.test.ts
```

```
EXITCODE=0
```

Clean, no warnings.

> Environment note (not a code defect): vitest browser mode fails in this sandbox with an EACCES
> port-bind error, so `--browser=false` was passed to every run, as instructed.

---

## Commit

Staged only the two new files with an explicit path list (no `git add -A`). Pre-existing unrelated
working-tree modifications (`.superpowers/sdd/progress.md`, `.superpowers/sdd/task-1-brief.md`,
`docs/superpowers/plans/2026-09-29-national-map-live-wiring.md`) were deliberately left untracked by
this commit and remain unstaged.

```
git add apps/web/src/features/map/lib/region-centroids.ts apps/web/src/features/map/lib/region-centroids.test.ts
git commit -m "feat(map): derive region centroids from live site coordinates"
```

```
[feat/map-live-wiring 826aec0] feat(map): derive region centroids from live site coordinates
 2 files changed, 112 insertions(+)
 create mode 100644 apps/web/src/features/map/lib/region-centroids.test.ts
 create mode 100644 apps/web/src/features/map/lib/region-centroids.ts

EXITCODE=0
```

`git show --stat` confirms exactly 2 files, 112 insertions, 0 deletions.

---

## Self-review findings

**Deviations from the brief (1, cosmetic):**
1. *Line endings.* The brief's code blocks are LF. I wrote both files with LF first, then converted
   them to CRLF because every sibling file in this working tree is CRLF (`core.autocrlf=true`, no
   `.gitattributes`). The committed blobs are LF-normalised by git exactly like all other files in
   the repo, so this is invisible in the commit. Code content is otherwise byte-identical to the brief.

**Wording mismatch in the brief (not a defect):**
2. *Step 2's predicted failure text.* The brief predicted `Failed to resolve import "./region-centroids"`;
   vitest 4.1.10 actually emits `Cannot find module './region-centroids' imported from …`. Same failure
   condition, different wording across vitest versions. Nothing to change.

**Observations to hand to Task 4 (deliberate gaps in the brief, NOT changed by me):**
3. *Points with an unknown region code are silently dropped.* `points` whose `region` is absent from
   `regions` never produce a summary. Correct for the "omit empty regions" rule, but it means the
   caller must pass a **complete** region list or those sites will vanish from the map without warning.
   No test covers this case.
4. *Duplicate region codes would emit duplicate summaries.* The function iterates `regions` without
   de-duplication, so a duplicated `{ code, name }` entry yields two identical centroids. The caller
   (Task 4) should pass a de-duplicated list. No test covers this case.
5. *Arithmetic-mean centroid is a flat-map average.* Averaging longitude/latitude is only a true centroid
   near the small extent of a single region, and is skewed by outliers (a bad GPS fix drags the marker).
   This is what the brief specifies, so I implemented it as written. If Task 8/9 shows visibly off-centre
   or jumping markers, the fix belongs in a later task, not here — a median, or excluding low-confidence
   points, would be the change to consider.
6. *No `outlier` / `confidence` filtering is available at this seam.* The signature takes bare
   `GeoPoint & { region }`, so a Task 4 caller wanting to drop low-confidence geocodes must filter
   before calling. Recording it so the caller is not surprised.

**Verified NOT a problem:**
7. The type-only import of `RegionSummary` from `./regions` (which itself imports the empty
   `getZones()` seed) is erased at compile time, so this module has no runtime data dependency on the
   mock-removal seed. Confirmed by the passing isolated test run.
