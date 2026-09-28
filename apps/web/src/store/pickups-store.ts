import { create } from 'zustand'
import { curated } from '@/lib/entity-data'
import { isHydrationFresh } from '@/lib/hydration'
import { api } from '@lpg/api-client'
import type { PickupRequest, PickupStatus } from '@lpg/types'
import { siteName, orgName, type Pickup } from '@/features/pickups/data/pickups'

export interface PickupDraft {
  marketeur_org_id: string
  source_site_id: string
  destination_site_id: string
  requested_quantity: number
  reference?: string
}

export function validatePickupDraft(draft: PickupDraft) {
  if (!draft.marketeur_org_id || !draft.source_site_id || !draft.destination_site_id) {
    throw new Error('mandatory fields: marketeur_org_id, source_site_id, destination_site_id are required')
  }
  if (draft.source_site_id === draft.destination_site_id) {
    throw new Error('chk_pickup_sites_different: source site and destination site must be different')
  }
  if (!draft.requested_quantity || draft.requested_quantity <= 0) {
    throw new Error('chk_pickup_quantity: requested quantity must be greater than 0')
  }
}

interface PickupsState {
  pickups: PickupRequest[]
  assignedVehicles: Record<string, string[]>
  loading: boolean
  error: string | null
  /** 3.8 — set once fetchPickups() has succeeded; per-page refreshes no-op while fresh. */
  hasLoaded: boolean
  lastFetchedAt: number
  all: () => PickupRequest[]
  viewById: (id: string) => PickupRequest | undefined
  fetchPickups: () => Promise<void>
  createPickup: (draft: PickupDraft, vehicleIds?: string[]) => PickupRequest
  createPickupAsync: (draft: PickupDraft, vehicleIds?: string[]) => Promise<PickupRequest>
  approvePickupAsync: (id: string, approvedQuantity: number) => Promise<PickupRequest>
  rejectPickupAsync: (id: string) => Promise<PickupRequest>
  cancelPickupAsync: (id: string) => Promise<PickupRequest>
  getPickupsView: () => Pickup[]
}

function mapPickupToView(p: PickupRequest, idx: number): Pickup {
  return {
    id: p.id,
    reference: p.reference || `PU-${1001 + idx}`,
    source_name: siteName(p.source_site_id),
    destination_name: siteName(p.destination_site_id),
    marketeur_name: orgName(p.marketeur_org_id),
    requested_quantity: p.requested_quantity,
    approved_quantity: p.approved_quantity ?? null,
    pickup_status: p.status,
    requested_at: p.created_at ?? new Date().toISOString(),
    validated_at: p.approved_quantity != null ? p.updated_at ?? p.created_at ?? null : null,
    started_at: null,
    completed_at: p.status === 'COMPLETED' ? p.updated_at ?? null : null,
    proof_url: null,
  }
}

export const usePickupsStore = create<PickupsState>()((set, get) => ({
  pickups: curated.pickup_requests.map((p) => ({ ...p })),
  assignedVehicles: {},
  loading: false,
  error: null,
  hasLoaded: false,
  lastFetchedAt: 0,

  all() {
    return get().pickups
  },

  viewById(id: string) {
    return get().pickups.find((p) => p.id === id)
  },

  async fetchPickups() {
    // 3.8 — single-flight + freshness: mount hydration and per-page
    // refreshes share one request; fresh data makes this a no-op.
    if (pickupsInflight) return pickupsInflight
    if (get().hasLoaded && isHydrationFresh(get().lastFetchedAt)) return
    pickupsInflight = (async () => {
      set({ loading: true, error: null })
      try {
        const res = await api.pickups.list(0, 100)
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          set({ pickups: res.data, loading: false, hasLoaded: true, lastFetchedAt: Date.now() })
        } else {
          set({ loading: false, hasLoaded: true, lastFetchedAt: Date.now() })
        }
      } catch {
        set({ loading: false })
      } finally {
        pickupsInflight = null
      }
    })()
    return pickupsInflight
  },

  createPickup(draft: PickupDraft, vehicleIds?: string[]) {
    validatePickupDraft(draft)
    const now = new Date().toISOString()
    const id = `pickup-${Date.now()}`
    const reference = draft.reference || `PU-${1001 + get().pickups.length}`
    const newRequest: PickupRequest = {
      id,
      reference,
      marketeur_org_id: draft.marketeur_org_id,
      source_site_id: draft.source_site_id,
      destination_site_id: draft.destination_site_id,
      requested_quantity: draft.requested_quantity,
      approved_quantity: null,
      status: 'DRAFT',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      created_by: null,
      updated_by: null,
      assigned_vehicle_ids: vehicleIds,
    }

    set({
      pickups: [newRequest, ...get().pickups],
      assignedVehicles: { ...get().assignedVehicles, [id]: vehicleIds ?? [] },
    })

    // Async sync with backend in background
    api.pickups.create(newRequest).then((created) => {
      if (created && created.id) {
        const next = get().pickups.map((p) => (p.id === id ? created : p))
        set({ pickups: next })
      }
    }).catch(() => {})

    return newRequest
  },

  async createPickupAsync(draft: PickupDraft, vehicleIds?: string[]) {
    validatePickupDraft(draft)
    const now = new Date().toISOString()
    const id = `pickup-${Date.now()}`
    const reference = draft.reference || `PU-${1001 + get().pickups.length}`
    const newRequest: PickupRequest = {
      id,
      reference,
      marketeur_org_id: draft.marketeur_org_id,
      source_site_id: draft.source_site_id,
      destination_site_id: draft.destination_site_id,
      requested_quantity: draft.requested_quantity,
      approved_quantity: null,
      status: 'DRAFT',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      created_by: null,
      updated_by: null,
      assigned_vehicle_ids: vehicleIds,
    }

    try {
      const created = await api.pickups.create(newRequest)
      const saved = created && created.id ? created : newRequest
      set({
        pickups: [saved, ...get().pickups.filter((p) => p.id !== saved.id)],
        assignedVehicles: { ...get().assignedVehicles, [saved.id]: vehicleIds ?? [] },
      })
      return saved
    } catch {
      set({
        pickups: [newRequest, ...get().pickups],
        assignedVehicles: { ...get().assignedVehicles, [id]: vehicleIds ?? [] },
      })
      return newRequest
    }
  },

  async approvePickupAsync(id: string, approvedQuantity: number) {
    try {
      const updated = await api.pickups.approve(id, approvedQuantity)
      const pickups = get().pickups.map((r) => (r.id === id ? { ...r, ...updated, status: 'VALIDATED' as PickupStatus, approved_quantity: approvedQuantity } : r))
      set({ pickups })
      return pickups.find((r) => r.id === id)!
    } catch {
      const pickups = get().pickups.map((r) => (r.id === id ? { ...r, status: 'VALIDATED' as PickupStatus, approved_quantity: approvedQuantity, updated_at: new Date().toISOString() } : r))
      set({ pickups })
      return pickups.find((r) => r.id === id)!
    }
  },

  async rejectPickupAsync(id: string) {
    try {
      await api.pickups.reject(id)
    } catch {
      // optimistic fallback
    }
    const pickups = get().pickups.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' as PickupStatus, updated_at: new Date().toISOString() } : r))
    set({ pickups })
    return pickups.find((r) => r.id === id)!
  },

  async cancelPickupAsync(id: string) {
    return get().rejectPickupAsync(id)
  },

  getPickupsView() {
    return get().pickups.map((r, idx) => mapPickupToView(r, idx))
  },
}))

// 3.8 — module-level single-flight for fetchPickups (shared by mount
// hydration and per-page refreshes).
let pickupsInflight: Promise<void> | null = null