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

function seededIndex(key: string, modulus: number): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h % modulus
}

const EXTRA_STATUSES: readonly PickupStatus[] = ['DRAFT', 'VALIDATED', 'CANCELLED']
const EXTRA_TIMES: readonly [string, string | null, string | null, string | null][] = [
  ['2024-10-02T08:00:00Z', '2024-10-03T10:00:00Z', null, null],
  ['2024-10-08T08:00:00Z', '2024-10-09T09:00:00Z', null, null],
  ['2024-09-20T08:00:00Z', null, null, null],
]

export function getPickups(): Pickup[] {
  const base = pickup_requests.map((p, i) => ({
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

  const extras: Pickup[] = EXTRA_STATUSES.map((status, idx) => {
    const source = sites[seededIndex(`src-${idx}`, Math.max(sites.length, 1))] ?? sites[0]!
    const destination = sites[seededIndex(`dst-${idx}`, Math.max(sites.length, 1))] ?? sites[Math.min(1, sites.length - 1)]!
    const marketeur = organizations.find((o) => o.type === 'MARKETEUR') ?? organizations[0]!
    const [requestedAt, validatedAt, startedAt, completedAt] = EXTRA_TIMES[idx]!
    return {
      id: `pickup-extra-${idx}`,
      reference: `PU-${2001 + idx}`,
      source_name: source.name,
      destination_name: destination.name,
      marketeur_name: marketeur.name,
      requested_quantity: 18000 + seededIndex(`qty-${idx}`, 4) * 18000,
      approved_quantity: status === 'VALIDATED' ? 18000 + seededIndex(`qty-${idx}`, 4) * 18000 : null,
      pickup_status: status,
      requested_at: requestedAt,
      validated_at: validatedAt,
      started_at: startedAt,
      completed_at: completedAt,
      proof_url: null,
    }
  })

  return [...base, ...extras]
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