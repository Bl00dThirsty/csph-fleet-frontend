import { create } from 'zustand'
import { curated } from '@lpg/mock-data'
import { api } from '@lpg/api-client'
import type { DeliveryTour, Checkpoint, ExecutionMode, TourneeType } from '@lpg/types'
import { toTourActivities, type TourActivity, type TourSlice } from '@/features/tours/data/tour-activity'
import {
  applyAction,
  tourActions,
  validateTour,
  type TourAction,
} from '@/features/tours/data/tour-machine'

/**
 * Payload for creating a tour. Mirrors the schema's `chk_tournee_internal` /
 * `chk_tournee_external` constraints: INTERNAL requires the marketeur's own
 * crew+vehicle, EXTERNAL requires a transporter_org_id and leaves the crew
 * NULL for the transporter to assign at acknowledgement time.
 */
export interface TourDraft {
  tour_code?: string
  marketeur_org_id: string
  execution_mode: ExecutionMode
  type: TourneeType
  requested_quantity: number
  transporter_org_id?: string | null
  vehicle_id?: string | null
  driver_id?: string | null
  livreur_user_id?: string | null
}

export interface ActionExtraParams {
  reason?: string
  loadedQuantity?: number
  deliveredQuantity?: number
  driverId?: string
  livreurPersonId?: string
  vehicleId?: string
}

interface ToursState {
  tours: DeliveryTour[]
  checkpoints: Checkpoint[]
  loading: boolean
  error: string | null
  fetchTours: () => Promise<void>
  createTour: (draft: TourDraft) => TourActivity
  createTourAsync: (draft: TourDraft) => Promise<TourActivity>
  performAction: (id: string, action: TourAction, extra?: ActionExtraParams) => TourActivity
  performActionAsync: (id: string, action: TourAction, extra?: ActionExtraParams) => Promise<TourActivity>
  assignDriver: (id: string, driverId?: string, livreurPersonId?: string) => Promise<TourActivity>
  assignVehicle: (id: string, vehicleId: string) => Promise<TourActivity>
  validateCheckpoint: (checkpointId: string) => Promise<void>
  skipCheckpoint: (checkpointId: string, reason: string) => Promise<void>
  views: (slice: TourSlice) => TourActivity[]
  viewById: (id: string) => TourActivity | undefined
}

export const useToursStore = create<ToursState>()((set, get) => ({
  tours: curated.delivery_tours.map((t) => ({ ...t })),
  checkpoints: curated.checkpoints.map((c) => ({ ...c })),
  loading: false,
  error: null,

  async fetchTours() {
    set({ loading: true, error: null })
    try {
      const res = await api.tours.list(0, 100)
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        set({ tours: res.data, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      // Fallback silently to existing local mock state
      set({ loading: false })
    }
  },

  createTour(draft: TourDraft) {
    const now = new Date().toISOString()
    const tour: DeliveryTour = {
      id: newTourId(),
      tour_code: draft.tour_code ?? `TRP-${Math.floor(1000 + Math.random() * 9000)}`,
      marketeur_org_id: draft.marketeur_org_id,
      execution_mode: draft.execution_mode,
      transporter_org_id: draft.transporter_org_id ?? null,
      vehicle_id: draft.vehicle_id ?? null,
      driver_id: draft.driver_id ?? null,
      livreur_user_id: draft.livreur_user_id ?? null,
      assigned_by_transporter_user_id: null,
      transporter_assigned_at: null,
      sent_to_transporter_at: null,
      type: draft.type,
      status: 'DRAFT',
      requested_quantity: draft.requested_quantity,
      loaded_quantity: null,
      delivered_quantity: null,
      started_at: null,
      closed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      created_by: null,
      updated_by: null,
    }
    const validation = validateTour(tour, { vehicles: curated.vehicles })
    if (!validation.valid) {
      throw new Error(validation.errors[0])
    }
    set({ tours: [tour, ...get().tours] })

    // If running with real backend, trigger async sync in background
    api.tours.create(tour).then((backendTour) => {
      if (backendTour && backendTour.id) {
        const currentTours = get().tours.map((t) => (t.id === tour.id ? backendTour : t))
        set({ tours: currentTours })
      }
    }).catch(() => {
      // Keep local optimistic copy
    })

    return toTourActivities([tour], { checkpoints: get().checkpoints })[0]!
  },

  async createTourAsync(draft: TourDraft) {
    const now = new Date().toISOString()
    const tour: DeliveryTour = {
      id: newTourId(),
      tour_code: draft.tour_code ?? `TRP-${Math.floor(1000 + Math.random() * 9000)}`,
      marketeur_org_id: draft.marketeur_org_id,
      execution_mode: draft.execution_mode,
      transporter_org_id: draft.transporter_org_id ?? null,
      vehicle_id: draft.vehicle_id ?? null,
      driver_id: draft.driver_id ?? null,
      livreur_user_id: draft.livreur_user_id ?? null,
      assigned_by_transporter_user_id: null,
      transporter_assigned_at: null,
      sent_to_transporter_at: null,
      type: draft.type,
      status: 'DRAFT',
      requested_quantity: draft.requested_quantity,
      loaded_quantity: null,
      delivered_quantity: null,
      started_at: null,
      closed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      created_by: null,
      updated_by: null,
    }
    const validation = validateTour(tour, { vehicles: curated.vehicles })
    if (!validation.valid) {
      throw new Error(validation.errors[0])
    }

    try {
      const created = await api.tours.create(tour)
      const saved = created && created.id ? created : tour
      set({ tours: [saved, ...get().tours.filter((t) => t.id !== saved.id)] })
      return toTourActivities([saved], { checkpoints: get().checkpoints })[0]!
    } catch {
      set({ tours: [tour, ...get().tours] })
      return toTourActivities([tour], { checkpoints: get().checkpoints })[0]!
    }
  },

  performAction(id: string, action: TourAction, extra?: ActionExtraParams) {
    const tours = get().tours
    const index = tours.findIndex((t) => t.id === id)
    if (index === -1) {
      throw new Error(`Tournée introuvable : ${id}`)
    }
    const current = tours[index]!
    const allowed = tourActions(current)
    if (!allowed.includes(action)) {
      throw new Error(`Transition interdite à l'état ${current.status}`)
    }
    const validation = validateTour(current, { vehicles: curated.vehicles })
    if (!validation.valid && action !== 'cancel') {
      throw new Error(validation.errors[0])
    }

    const result = applyAction(current, action, new Date())
    const next: DeliveryTour = { ...current, ...result }
    if (extra?.loadedQuantity != null) next.loaded_quantity = extra.loadedQuantity
    if (extra?.deliveredQuantity != null) next.delivered_quantity = extra.deliveredQuantity

    tours[index] = next
    set({ tours: [...tours] })

    // Sync transition with backend API in background
    if (action === 'start') {
      api.tours.start(id).catch(() => {})
    } else if (action === 'close') {
      api.tours.close(id, extra?.loadedQuantity, extra?.deliveredQuantity).catch(() => {})
    } else if (action === 'cancel') {
      api.tours.cancel(id, extra?.reason).catch(() => {})
    }

    return toTourActivities([next], { checkpoints: get().checkpoints })[0]!
  },

  async performActionAsync(id: string, action: TourAction, extra?: ActionExtraParams) {
    const tours = get().tours
    const index = tours.findIndex((t) => t.id === id)
    if (index === -1) {
      throw new Error(`Tournée introuvable : ${id}`)
    }
    const current = tours[index]!
    const allowed = tourActions(current)
    if (!allowed.includes(action)) {
      throw new Error(`Transition interdite à l'état ${current.status}`)
    }

    try {
      let updated: DeliveryTour
      if (action === 'start') {
        updated = await api.tours.start(id)
      } else if (action === 'close') {
        updated = await api.tours.close(id, extra?.loadedQuantity, extra?.deliveredQuantity)
      } else if (action === 'cancel') {
        updated = await api.tours.cancel(id, extra?.reason)
      } else {
        const result = applyAction(current, action, new Date())
        updated = { ...current, ...result }
      }

      const nextTours = [...get().tours]
      const targetIdx = nextTours.findIndex((t) => t.id === id)
      if (targetIdx !== -1) nextTours[targetIdx] = updated
      set({ tours: nextTours })
      return toTourActivities([updated], { checkpoints: get().checkpoints })[0]!
    } catch {
      return get().performAction(id, action, extra)
    }
  },

  async assignDriver(id: string, driverId?: string, livreurPersonId?: string) {
    try {
      const updated = await api.tours.assignDriver(id, driverId, livreurPersonId)
      const nextTours = [...get().tours]
      const idx = nextTours.findIndex((t) => t.id === id)
      if (idx !== -1) nextTours[idx] = updated
      set({ tours: nextTours })
      return toTourActivities([updated], { checkpoints: get().checkpoints })[0]!
    } catch {
      const current = get().tours.find((t) => t.id === id)
      if (!current) throw new Error('Tournée introuvable')
      const next = { ...current, driver_id: driverId ?? current.driver_id, livreur_user_id: livreurPersonId ?? current.livreur_user_id }
      const nextTours = get().tours.map((t) => (t.id === id ? next : t))
      set({ tours: nextTours })
      return toTourActivities([next], { checkpoints: get().checkpoints })[0]!
    }
  },

  async assignVehicle(id: string, vehicleId: string) {
    try {
      const updated = await api.tours.assignVehicle(id, vehicleId)
      const nextTours = [...get().tours]
      const idx = nextTours.findIndex((t) => t.id === id)
      if (idx !== -1) nextTours[idx] = updated
      set({ tours: nextTours })
      return toTourActivities([updated], { checkpoints: get().checkpoints })[0]!
    } catch {
      const current = get().tours.find((t) => t.id === id)
      if (!current) throw new Error('Tournée introuvable')
      const next = { ...current, vehicle_id: vehicleId }
      const nextTours = get().tours.map((t) => (t.id === id ? next : t))
      set({ tours: nextTours })
      return toTourActivities([next], { checkpoints: get().checkpoints })[0]!
    }
  },

  async validateCheckpoint(checkpointId: string) {
    try {
      await api.tours.validateCheckpoint(checkpointId)
    } catch {
      // Optimistic local update
    }
    const checkpoints = get().checkpoints.map((c) =>
      c.id === checkpointId
        ? { ...c, status: 'COMPLETED' as const, actual_arrival: new Date().toISOString() }
        : c,
    )
    set({ checkpoints })
  },

  async skipCheckpoint(checkpointId: string, reason: string) {
    try {
      await api.tours.skipCheckpoint(checkpointId, reason)
    } catch {
      // Optimistic local update
    }
    const checkpoints = get().checkpoints.map((c) =>
      c.id === checkpointId
        ? { ...c, status: 'SKIPPED' as const, skip_reason: reason }
        : c,
    )
    set({ checkpoints })
  },

  views(slice: TourSlice) {
    const tours = get().tours
    const filtered =
      slice === 'ALL'
        ? tours
        : tours.filter((t) => {
            switch (slice) {
              case 'INTERNAL':
                return t.execution_mode === 'INTERNAL'
              case 'EXTERNAL':
                return t.execution_mode === 'EXTERNAL'
              case 'PENDING':
                return t.status === 'PENDINGTRANSPORTERACK'
              case 'ACTIVE':
                return t.status === 'INPROGRESS' || t.status === 'CHECKPOINTACTIVE'
              case 'HISTORY':
                return t.status === 'CLOSED' || t.status === 'CANCELLED'
              default:
                return true
            }
          })
    return toTourActivities(
      [...filtered].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
      { checkpoints: get().checkpoints },
    )
  },

  viewById(id: string) {
    const index = get().tours.findIndex((t) => t.id === id)
    if (index === -1) return undefined
    return toTourActivities([get().tours[index]!], { checkpoints: get().checkpoints })[0]
  },
}))

export function newTourId(): string {
  return `tournee-${Date.now()}`
}