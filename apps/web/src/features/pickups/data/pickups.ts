import { pickup_requests, sites, client_sites, organizations } from '@/lib/entity-data'
import type { PickupStatus } from '@lpg/types'

export type { PickupStatus }

export interface Pickup {
  id: string
  reference: string
  source_name: string
  destination_name: string
  marketeur_name: string
  requested_quantity: number
  approved_quantity: number | null
  pickup_status: PickupStatus
  requested_at: string
  validated_at: string | null
  started_at: string | null
  completed_at: string | null
  proof_url: string | null
}

export const pickupStatusLabels: Record<PickupStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'ValidÃ©e',
  INPROGRESS: 'En cours',
  COMPLETED: 'TerminÃ©e',
  CANCELLED: 'AnnulÃ©e',
}

export const pickupStatusOptions: readonly { label: string; value: PickupStatus }[] = (
  Object.keys(pickupStatusLabels) as PickupStatus[]
).map((v) => ({ label: pickupStatusLabels[v], value: v }))

const allSites = [...sites, ...client_sites]

export function siteName(id: string): string {
  return allSites.find((s) => s.id === id)?.name ?? id
}

export function orgName(id: string): string {
  return organizations.find((o) => o.id === id)?.name ?? id
}

/**
 * Live-only accessor over the pickups store rows. No seeded extras: when the
 * backend returns nothing (or RBAC denies the query) this returns [] and the
 * pages render their empty states instead of crashing on fabricated joins.
 */
export function getPickups(): Pickup[] {
  return pickup_requests.map((p, i) => ({
    id: p.id,
    reference: `PU-${1001 + i}`,
    source_name: siteName(p.source_site_id),
    destination_name: siteName(p.destination_site_id),
    marketeur_name: orgName(p.marketeur_org_id),
    requested_quantity: p.requested_quantity,
    approved_quantity: p.approved_quantity ?? null,
    pickup_status: p.status,
    requested_at: p.created_at ?? '',
    validated_at: p.approved_quantity != null ? p.created_at ?? null : null,
    started_at: null,
    completed_at: p.status === 'COMPLETED' ? p.updated_at ?? null : null,
    proof_url: null,
  }))
}

export function getPickupSummary(rows: Pickup[]) {
  return {
    total: rows.length,
    draft: rows.filter((r) => r.pickup_status === 'DRAFT').length,
    validated: rows.filter((r) => r.pickup_status === 'VALIDATED').length,
    inProgress: rows.filter((r) => r.pickup_status === 'INPROGRESS').length,
    completed: rows.filter((r) => r.pickup_status === 'COMPLETED').length,
    cancelled: rows.filter((r) => r.pickup_status === 'CANCELLED').length,
  }
}