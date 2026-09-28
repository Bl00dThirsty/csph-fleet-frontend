import { create } from 'zustand'
import { api } from '@lpg/api-client'
import type { Checkpoint, DeliveryTour, ExecutionMode, TourneeType } from '@lpg/types'
import { isHydrationFresh } from '@/lib/hydration'
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
  /** Checkpoints grouped by tour id — populated by fetchCheckpoints. */
  checkpointsByTour: Record<string, Checkpoint[]>
  checkpointsLoading: Record<string, boolean>
  loading: boolean
  error: string | null
  /** 3.8 — set once fetchTours() has succeeded; per-page refreshes no-op while fresh. */
  hasLoaded: boolean
  lastFetchedAt: number
  fetchTours: () => Promise<void>
  fetchCheckpoints: (tourId: string) => Promise<Checkpoint[]>
  createTour: (draft: TourDraft) => TourActivity
  createTourAsync: (draft: TourDraft) => Promise<TourActivity>
  performAction: (id: string, action: TourAction, extra?: ActionExtraParams) => TourActivity
  performActionAsync: (id: string, action: TourAction, extra?: ActionExtraParams) => Promise<TourActivity>
  assignDriver: (id: string, driverId?: string, livreurPersonId?: string) => Promise<TourActivity>
  assignVehicle: (id: string, vehicleId: string) => Promise<TourActivity>
  reachCheckpoint: (checkpointId: string) => Promise<Checkpoint>
  completeCheckpoint: (checkpointId: string) => Promise<Checkpoint>
  skipCheckpoint: (checkpointId: string, reason: string) => Promise<Checkpoint>
  views: (slice: TourSlice) => TourActivity[]
  viewById: (id: string) => TourActivity | undefined
}

function serverErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err !== null) {
    const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (message) return message
  }
  return fallback
}

function buildDraftTour(draft: TourDraft): DeliveryTour {
  const now = new Date().toISOString()
  // No client-side id: the server assigns the UUID on create. Sending
  // `tournee-${Date.now()}` would put a fabricated identifier on the wire.
  // tour_code is @NotBlank server-side: it comes from the operator's dialog
  // input, never from a random fallback.
  const tourCode = draft.tour_code?.trim()
  if (!tourCode) {
    throw new Error('Le code de tournée est obligatoire (saisissez-le dans le dialogue)')
  }
  return {
    id: '',
    tour_code: tourCode,
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
}

function checkpointTourId(checkpoint: Pick<Checkpoint, 'tournee_id' | 'tour_id'>): string | null {
  return checkpoint.tournee_id ?? checkpoint.tour_id ?? null
}

function normalizeCheckpointRow(row: unknown, tourId: string): Checkpoint {
  if (!row || typeof row !== 'object') {
    throw new Error('Réponse serveur invalide : point de contrôle illisible')
  }
  const record = row as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.status !== 'string') {
    throw new Error('Réponse serveur invalide : point de contrôle sans identifiant ni statut')
  }
  return {
    ...(record as object),
    tournee_id: (record.tournee_id as string | undefined) ?? (record.tour_id as string | undefined) ?? tourId,
  } as Checkpoint
}

function applyCheckpointUpdate(checkpoints: Checkpoint[], updated: Checkpoint): Checkpoint[] {
  const index = checkpoints.findIndex((c) => c.id === updated.id)
  if (index === -1) return [...checkpoints, updated]
  const next = [...checkpoints]
  next[index] = updated
  return next
}

export const useToursStore = create<ToursState>()((set, get) => ({
  tours: [],
  checkpoints: [],
  checkpointsByTour: {},
  checkpointsLoading: {},
  loading: false,
  error: null,
  hasLoaded: false,
  lastFetchedAt: 0,

  async fetchTours() {
    if (get().hasLoaded && isHydrationFresh(get().lastFetchedAt)) return
    set({ loading: true, error: null })
    try {
      const res = await api.tours.list(0, 100)
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        set({ tours: res.data as DeliveryTour[], loading: false, hasLoaded: true, lastFetchedAt: Date.now() })
      } else {
        set({ loading: false, hasLoaded: true, lastFetchedAt: Date.now() })
      }
    } catch (err) {
      set({
        loading: false,
        error: serverErrorMessage(err, 'Tournées indisponibles — vérifiez la liaison API'),
      })
    }
  },

  async fetchCheckpoints(tourId: string) {
    if (!tourId) {
      throw new Error('Identifiant de tournée manquant')
    }
    set({ checkpointsLoading: { ...get().checkpointsLoading, [tourId]: true } })
    let rows: unknown
    try {
      rows = await api.tours.getCheckpoints(tourId)
    } catch (err) {
      set({ checkpointsLoading: { ...get().checkpointsLoading, [tourId]: false } })
      throw new Error(
        serverErrorMessage(err, `Points de contrôle indisponibles pour la tournée ${tourId}`),
      )
    }
    const list = (Array.isArray(rows) ? rows : []).map((row) => normalizeCheckpointRow(row, tourId))
    const kept = get().checkpoints.filter((c) => checkpointTourId(c) !== tourId)
    set({
      checkpoints: [...kept, ...list],
      checkpointsByTour: { ...get().checkpointsByTour, [tourId]: list },
      checkpointsLoading: { ...get().checkpointsLoading, [tourId]: false },
      error: null,
    })
    return list
  },

  createTour(draft: TourDraft) {
    // Local-only builder. Server persistence goes through createTourAsync,
    // which awaits confirmation before mutating state.
    const tour = buildDraftTour(draft)
    const validation = validateTour(tour)
    if (!validation.valid) {
      throw new Error(validation.errors[0])
    }
    set({ tours: [tour, ...get().tours] })

    return toTourActivities([tour], { checkpoints: get().checkpoints })[0]!
  },

  async createTourAsync(draft: TourDraft) {
    const tour = buildDraftTour(draft)
    const validation = validateTour(tour)
    if (!validation.valid) {
      throw new Error(validation.errors[0])
    }

    let saved: unknown
    try {
      saved = await api.tours.create(tour)
    } catch (err) {
      throw new Error(serverErrorMessage(err, 'Création de tournée refusée par le serveur'))
    }
    const created = saved as DeliveryTour | null
    if (!created || typeof created.id !== 'string') {
      throw new Error('Réponse serveur invalide : tournée non créée')
    }
    set({
      tours: [created, ...get().tours.filter((t) => t.id !== created.id)],
      error: null,
    })
    return toTourActivities([created], { checkpoints: get().checkpoints })[0]!
  },

  performAction(id: string, action: TourAction, extra?: ActionExtraParams) {
    // Local-only transition preview. Server-confirmed transitions go through
    // performActionAsync, which awaits the endpoint before mutating state.
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
    const validation = validateTour(current)
    if (!validation.valid && action !== 'cancel') {
      throw new Error(validation.errors[0])
    }

    const result = applyAction(current, action, new Date())
    const next: DeliveryTour = { ...current, ...result }
    if (extra?.loadedQuantity != null) next.loaded_quantity = extra.loadedQuantity
    if (extra?.deliveredQuantity != null) next.delivered_quantity = extra.deliveredQuantity

    tours[index] = next
    set({ tours: [...tours] })

    return toTourActivities([next], { checkpoints: get().checkpoints })[0]!
  },

  async performActionAsync(id: string, action: TourAction, extra?: ActionExtraParams) {
    const current = get().tours.find((t) => t.id === id)
    if (!current) {
      throw new Error(`Tournée introuvable : ${id}`)
    }
    const allowed = tourActions(current)
    if (!allowed.includes(action)) {
      throw new Error(`Transition interdite à l'état ${current.status}`)
    }

    let updated: unknown
    try {
      switch (action) {
        case 'plan':
          updated = await api.tours.plan(id)
          break
        case 'send-to-transporter':
          updated = await api.tours.sendToTransporter(id)
          break
        case 'acknowledge':
          updated = await api.tours.acknowledge(id)
          break
        case 'start':
          updated = await api.tours.start(id)
          break
        case 'close':
          updated = await api.tours.close(id, extra?.loadedQuantity, extra?.deliveredQuantity)
          break
        case 'cancel':
          updated = await api.tours.cancel(id, extra?.reason)
          break
      }
    } catch (err) {
      throw new Error(serverErrorMessage(err, 'Action refusée par le serveur'))
    }
    const saved = updated as DeliveryTour | null
    if (!saved || typeof saved.id !== 'string') {
      throw new Error('Réponse serveur invalide : tournée non confirmée')
    }

    set({
      tours: get().tours.map((t) => (t.id === id ? saved : t)),
      error: null,
    })
    return toTourActivities([saved], { checkpoints: get().checkpoints })[0]!
  },

  async assignDriver(id: string, driverId?: string, livreurPersonId?: string) {
    let updated: unknown
    try {
      updated = await api.tours.assignDriver(id, driverId, livreurPersonId)
    } catch (err) {
      throw new Error(serverErrorMessage(err, 'Affectation du chauffeur refusée par le serveur'))
    }
    const saved = updated as DeliveryTour | null
    if (!saved || typeof saved.id !== 'string') {
      throw new Error('Réponse serveur invalide : chauffeur non affecté')
    }
    set({
      tours: get().tours.map((t) => (t.id === id ? saved : t)),
      error: null,
    })
    return toTourActivities([saved], { checkpoints: get().checkpoints })[0]!
  },

  async assignVehicle(id: string, vehicleId: string) {
    let updated: unknown
    try {
      updated = await api.tours.assignVehicle(id, vehicleId)
    } catch (err) {
      throw new Error(serverErrorMessage(err, 'Affectation du véhicule refusée par le serveur'))
    }
    const saved = updated as DeliveryTour | null
    if (!saved || typeof saved.id !== 'string') {
      throw new Error('Réponse serveur invalide : véhicule non affecté')
    }
    set({
      tours: get().tours.map((t) => (t.id === id ? saved : t)),
      error: null,
    })
    return toTourActivities([saved], { checkpoints: get().checkpoints })[0]!
  },

  async reachCheckpoint(checkpointId: string) {
    let updated: unknown
    try {
      updated = await api.tours.reachCheckpoint(checkpointId)
    } catch (err) {
      throw new Error(serverErrorMessage(err, 'Arrivée refusée par le serveur'))
    }
    const saved = updated as Checkpoint | null
    if (!saved || typeof saved.id !== 'string' || typeof saved.status !== 'string') {
      throw new Error('Réponse serveur invalide : arrivée non confirmée')
    }
    const tourId = checkpointTourId(saved) ?? get().checkpoints.find((c) => c.id === checkpointId)?.tournee_id ?? null
    set({
      checkpoints: applyCheckpointUpdate(get().checkpoints, saved),
      checkpointsByTour:
        tourId != null
          ? {
              ...get().checkpointsByTour,
              [tourId]: applyCheckpointUpdate(get().checkpointsByTour[tourId] ?? [], saved),
            }
          : get().checkpointsByTour,
      error: null,
    })
    return saved
  },

  async completeCheckpoint(checkpointId: string) {
    let updated: unknown
    try {
      updated = await api.tours.completeCheckpoint(checkpointId)
    } catch (err) {
      throw new Error(serverErrorMessage(err, 'Validation refusée par le serveur'))
    }
    const saved = updated as Checkpoint | null
    if (!saved || typeof saved.id !== 'string' || typeof saved.status !== 'string') {
      throw new Error('Réponse serveur invalide : point non validé')
    }
    const tourId = checkpointTourId(saved) ?? get().checkpoints.find((c) => c.id === checkpointId)?.tournee_id ?? null
    set({
      checkpoints: applyCheckpointUpdate(get().checkpoints, saved),
      checkpointsByTour:
        tourId != null
          ? {
              ...get().checkpointsByTour,
              [tourId]: applyCheckpointUpdate(get().checkpointsByTour[tourId] ?? [], saved),
            }
          : get().checkpointsByTour,
      error: null,
    })
    return saved
  },

  async skipCheckpoint(checkpointId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new Error('Motif obligatoire pour sauter un point de contrôle')
    }
    let updated: unknown
    try {
      updated = await api.tours.skipCheckpoint(checkpointId, reason.trim())
    } catch (err) {
      throw new Error(serverErrorMessage(err, 'Saut refusé par le serveur'))
    }
    const saved = updated as Checkpoint | null
    if (!saved || typeof saved.id !== 'string' || typeof saved.status !== 'string') {
      throw new Error('Réponse serveur invalide : saut non confirmé')
    }
    const tourId = checkpointTourId(saved) ?? get().checkpoints.find((c) => c.id === checkpointId)?.tournee_id ?? null
    set({
      checkpoints: applyCheckpointUpdate(get().checkpoints, saved),
      checkpointsByTour:
        tourId != null
          ? {
              ...get().checkpointsByTour,
              [tourId]: applyCheckpointUpdate(get().checkpointsByTour[tourId] ?? [], saved),
            }
          : get().checkpointsByTour,
      error: null,
    })
    return saved
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
  // Legacy helper kept for compat; new tours get their id from the server on
  // create (see buildDraftTour). Do not use for new rows.
  return `tournee-${Date.now()}`
}
