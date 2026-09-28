# AGENTS.md — LPG Fleet Management UI

Project conventions. Apply these on **every** task. They are non-negotiable unless you ask the
user and they explicitly override.

## 1. Source of truth (reference documents)

- `../TODO.md` — the master audit & implementation guide (schema, API map, state machines,
  role-by-role navigation, workflows, security). **Follow its logic and acceptance criteria.**
- `../csph_gpl_schema_v6_2.sql` — the canonical database schema. It, not local files, defines
  the domain model, **table names, column names, and ENUM values**.

When types, statuses, or business rules are needed, resolve them against these two files first.

## 2. Canonical reference interfaces

Only the following base routes contain the reference code/methodology that all other screens
**must** replicate. Treat them as the pattern to copy:

- `/trucks`
- `/transporters`
- `/marketers`
- `/routes`
- `/activity/trip-tracking`
- `/dashboard`

Every new screen / feature must follow the exact same structure and conventions.

## 3. Feature folder pattern (mandatory, no exceptions)

One domain = one feature tree under `features/<domain>/`, with a static route in
`routes/_authenticated/<domain>/` that imports it:

```
features/<domain>/
  index.tsx          # page entry — exports <Domain>Page
  components/        # presentational pieces, tables, columns
  data/              # data access / view-builders / fixtures (SINGLE source of data)
  lib/               # pure logic: state machines, business rules + colocated tests
  utils/             # pure helpers
```

Rules:
- **One file per responsibility. No file has a duplicate** (root vs `components/` vs `data/`
  with the same name is forbidden). If you need to move a file, move it — never copy it.
- Data/models live in `data/`, never re-declared at the feature root.
- A `components/` or `data/` sibling that already exists is the LIVE version; a stale root copy
  is dead code — delete it and re-point importers.
- Tests live next to the pure logic they cover (`lib/*.test.ts`).
- Icons/components come from the local `components/ui` tree / `@lpg/ui` — do not fork import
  paths across a feature (pick one convention per feature and keep it consistent).
- VRAC (GPL vrac) → TM (tonnes métriques). Never kg, never bare t.
- Bouteilles 50 kg → btl (count of individual bottles).

## 4. Business rules & system conventions

- **No mock/demo data, ever.** No fixture packages, no fake adapters, no
  seeded rows in app code, no invented fallback values (quantities, counts,
  coordinates, statuses). Views render empty until their store hydrates live
  rows via `@lpg/api-client`. Test inputs live in test files, never in
  shipped code.

- **Settings-Driven, zero hardcoded thresholds.** Business rules never embed raw
  values. Geo confidence thresholds (`geo.confidence_*`), battery/offline alerts
  (`device.battery_critical_threshold`, `device.offline_alert_minutes`), SLA
  timeouts (`tournee.*`), tolerance percentages
  (`reconciliation.volume_gap_tolerance_percent`), retention years
  (`audit.retention_years`), MFA enforcement (`mfa.enforced_for_roles`), GPS
  capture interval, and report expiry are read by `setting_key` from the
  `settings` model (accessor `getSettingNumber` in
  `apps/web/src/lib/entity-data.ts`; live values arrive via `api.settings`,
  every call site carries an explicit fallback — null is never invented into
  a threshold).
- **Role hierarchy:** SUPERADMIN > ADMIN > SUPERVISOR/AGENT/INTEGRATEUR >
  MARKETEUR/TRANSPORTEUR > LIVREUR. A user may only create subordinates at or
  below their own level (`HIERARCHY_LEVEL` / `canCreate` in `@lpg/permissions`).
- **Dual-layer RBAC:** effective permissions = `system_role` base grants OR
  `custom_roles` (JSONB) overrides, scoped by `user_site_assignments`. The web
  matrix (`ROLE_GRANTS`) models the base layer; sidebars and route guards consume
  it. No feature may rely solely on `system_role`.
- **No organizational view for MARKETEUR.** MARKETEUR-role users work on-site
  (e.g. site director of a MARKETEUR org). They never see organization-level
  entity views (`/marketers`, `/organizations`); their home view is `/overview`.
  Org-level entity management belongs to SUPERADMIN/ADMIN/AGENT.
- **File storage:** all images, certificates, and proofs live in MinIO
  (S3-compatible); only URL references are kept in the database.
- **API envelope:** every response is `{ success, message, data, pagination?, filters? }`.
- **Status lifecycles** come from the schema (device, RFID, pickup, tour, site) —
  never invent new status strings.
- **Workflows** resolve against TODO.md §5 (onboarding, geo-verification, certificates,
  device lifecycle, flux 1 / 2a / 2b, reconciliation, anomalies, risk, reporting);
  **monitoring/security** against TODO.md §6–§7.

## 5. Routing & navigation

- **Only static feature routes exist.** There is **no** `$role/$module` dynamic router, no
  `ModuleScreen`, no `MODULE_CATALOG` — do not reintroduce a generic module grid.
- The single `AppSidebar` drives navigation for all roles.
- Role/actor visibility is expressed **permission-gated** in `config/rbac/nav-items.ts` via
  `requires` (from `@lpg/permissions`), **not** by URL-prefixing with a role slug.
- The active actor determines which nav links show (actor point-of-view). Respect the
  role hierarchy: SUPERADMIN > ADMIN > SUPERVISOR/AGENT/INTEGRATEUR >
  MARKETEUR/TRANSPORTEUR > LIVREUR.
- Post-login landing is per-role. Only SUPERADMIN lands on `/dashboard`; other roles land on
  their own home feature (e.g. TRANSPORTEUR → `/transporters`, MARKETEUR → `/overview`).

## 6. Code naming & units

- **English** in code everywhere: file/folder names, exports, URLs, types, variables.
- **French** only in user-facing `label` strings (i18n UI).
- **UPPERCASE** for all ENUM values and type names (schema rule). Never snake_case enum values.
- Units: **VRAC quantities are TM (tonnes métriques), NOT liters.** Bouteilles are counted as
  individual 50 kg units (TM / btl displayed accordingly).
- No hardcoded thresholds/business rules — reference the `settings` model by key.
- Status flows (e.g. `tournee_status`, `pickup_status`, site lifecycle) come from the schema —
  never invent new status strings.

## 7. Types & duplication budget

- Shared domain types/enums come from `@lpg/types` (+ `@lpg/permissions` for RBAC). Never
  re-declare `Site`, `PickupStatus`, `VehicleType`, `Role`, etc. locally.
- **Redundancy budget is ZERO.** Before adding a file, grep for an existing equivalent. A new
  feature means a new directory; an update means editing the existing file, not adding a
  parallel one.

## 8. Process (always)

- **Before creative work** (new features/screens/refactors): brainstorm → ask clarifying
  questions if anything is ambiguous → then implement. Never jump straight to code.
- **Ask** when there is >1 reasonable approach. Don't guess.
- **Apply frontend/design skills** when shaping UI.
- **Verify before claiming done:** run typecheck, lint, and tests (`npm run typecheck`,
  `npm run lint`, `npm test`) and confirm green. Provide evidence.
- Do not commit unless the user explicitly asks.

Note: TODO.md, schema SQL, and this file change over time — re-read them as needed; this file
is the standing contract and should be kept in sync with any new rule the user adds.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context — read `CONTEXT.md` and `docs/adr/` at the repo root when exploring the codebase. See `docs/agents/domain.md`.