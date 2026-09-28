/**
 * Role → sidebar routing.
 *
 * The actual sidebar content is permission-driven: see `./nav-items.ts`.
 * This file only exposes:
 *
 *   • `LANDING_BY_ROLE` — the bare feature path each role lands on after
 *     login (single source of truth; used by `routes/_authenticated/index.tsx`
 *     and the route-access guard).
 *   • `getSidebarData(role)` — delegates to `buildSidebarFor(role)`.
 *
 * Per AGENTS.md §5 there are **no role-prefixed URLs**: every nav item points
 * at a bare feature path (`/trucks`, `/marketers`, …) regardless of the
 * active role. The role only governs *which* items are visible, never the
 * URL shape. Link labels, icons, and permission codes live in `nav-items.ts`.
 *
 * All web roles now land on `/overview` after login. The `/dashboard` route
 * remains SUperADMIN-only (gated by `dashboard.read`). Per-role dashboards
 * for ADMIN, SUPERVISOR, MARKETEUR, TRANSPORTEUR are available at
 * `/dashboard-admin`, `/dashboard-supervisor`, `/dashboard-marketeur`,
 * `/dashboard-transporteur` respectively.
 */

import type { Role } from '@lpg/permissions'
import type { SidebarData } from '@/components/layout/types'
import { buildSidebarFor } from './nav-items'

/**
 * Post-login / post-switch landing path per role. Bare feature routes only
 * (AGENTS.md §5). Each role lands on its own home feature — a route that
 * actually exists. `/dashboard` is reserved for roles with no dedicated home
 * feature yet (SUPERADMIN per §5; SUPERVISOR & LIVREUR until built).
 *
 * GAP: the `overview` nav item still resolves to `/overview`, which has no
 * route — see TODO: give SUPERVISOR/ADMIN/AGENT a real technical home.
 *
 * DRIVER is PDA-only (no web interface); it lands on /tours like LIVREUR so a
 * driver session that somehow reaches the web sees missions, not a 404.
 */
export const LANDING_BY_ROLE: Record<Role, string> = {
  SUPERADMIN: '/dashboard',
  ADMIN: '/dashboard-admin',
  SUPERVISOR: '/dashboard-supervisor',
  INTEGRATEUR: '/dashboard-supervisor',
  AGENT: '/overview',
  MARKETEUR: '/dashboard-marketeur',
  TRANSPORTEUR: '/dashboard-transporteur',
  LIVREUR: '/tours',
  DRIVER: '/tours',
}

/** Delegates entirely to the permission-driven projection. */
export function getSidebarData(role: Role): SidebarData {
  return buildSidebarFor(role)
}

/**
 * Landing path for a role (clamped to `/dashboard` for unknown roles).
 * Shared by the post-login redirect and the role switcher so they can never
 * drift apart.
 */
export function landingPathFor(role: Role): string {
  return LANDING_BY_ROLE[role] ?? '/dashboard'
}