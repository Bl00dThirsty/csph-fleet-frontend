import type { DeliveryTour, Setting, TourneeStatus, ExecutionMode, Vehicle } from '@lpg/types'

export type TourAction =
  | 'send-to-transporter'
  | 'acknowledge'
  | 'plan'
  | 'start'
  | 'close'
  | 'cancel'

export const TOUR_ACTION_LABELS: Record<TourAction, string> = {
  'send-to-transporter': 'Envoyer au transporteur',
  acknowledge: 'Accuser réception',
  plan: 'Planifier',
  start: 'Démarrer',
  close: 'Clôturer',
  cancel: 'Annuler',
}

const TERMINAL_STATUSES: ReadonlySet<TourneeStatus> = new Set(['CLOSED', 'CANCELLED'])

const EXTERNAL_CHAIN: ReadonlyArray<TourneeStatus> = [
  'DRAFT',
  'PENDINGTRANSPORTERACK',
  'ACKNOWLEDGED',
  'INPROGRESS',
  'CHECKPOINTACTIVE',
  'CLOSED',
]

const INTERNAL_CHAIN: ReadonlyArray<TourneeStatus> = [
  'DRAFT',
  'PLANNED',
  'INPROGRESS',
  'CHECKPOINTACTIVE',
  'CLOSED',
]

const CHAINS: Record<ExecutionMode, ReadonlyArray<TourneeStatus>> = {
  INTERNAL: INTERNAL_CHAIN,
  EXTERNAL: EXTERNAL_CHAIN,
}

const ALL_ACTIONS: TourAction[] = ['send-to-transporter', 'acknowledge', 'plan', 'start', 'close', 'cancel']

/**
 * Cancel is only available before a tour goes out on the road. Once INPROGRESS /
 * CHECKPOINTACTIVE the tour must run to CLOSED (a late abort is handled by the
 * site/checkpoint anomaly flow, not by a status transition).
 */
const CANCELLABLE: ReadonlySet<TourneeStatus> = new Set([
  'DRAFT',
  'PLANNED',
  'PENDINGTRANSPORTERACK',
  'ACKNOWLEDGED',
])

interface ActionSpec {
  target: TourneeStatus
  modes: ExecutionMode[]
}

const ACTION_TARGET: Record<TourAction, ActionSpec> = {
  'send-to-transporter': { target: 'PENDINGTRANSPORTERACK', modes: ['EXTERNAL'] },
  acknowledge: { target: 'ACKNOWLEDGED', modes: ['EXTERNAL'] },
  plan: { target: 'PLANNED', modes: ['INTERNAL'] },
  start: { target: 'INPROGRESS', modes: ['INTERNAL', 'EXTERNAL'] },
  close: { target: 'CLOSED', modes: ['INTERNAL', 'EXTERNAL'] },
  cancel: { target: 'CANCELLED', modes: ['INTERNAL', 'EXTERNAL'] },
}

function immediateNext(from: TourneeStatus, mode: ExecutionMode): TourneeStatus | undefined {
  const chain = CHAINS[mode]
  const idx = chain.indexOf(from)
  return idx === -1 || idx === chain.length - 1 ? undefined : chain[idx + 1]
}

export function canTransition(from: TourneeStatus, to: TourneeStatus, mode: ExecutionMode): boolean {
  if (TERMINAL_STATUSES.has(from)) return false
  if (to === 'CANCELLED') return CANCELLABLE.has(from)
  return immediateNext(from, mode) === to
}

export function nextStatuses(from: TourneeStatus, mode: ExecutionMode): TourneeStatus[] {
  if (TERMINAL_STATUSES.has(from)) return []
  const next = immediateNext(from, mode)
  const statuses = next ? [next] : []
  if (CANCELLABLE.has(from)) statuses.push('CANCELLED')
  return statuses
}

export function tourActions(tour: Pick<DeliveryTour, 'status' | 'execution_mode'>): TourAction[] {
  const { status, execution_mode } = tour
  return ALL_ACTIONS.filter((action) => {
    const spec = ACTION_TARGET[action]
    if (!spec.modes.includes(execution_mode)) return false
    return canTransition(status, spec.target, execution_mode)
  }).sort()
}

export interface TourValidationResult {
  valid: boolean
  errors: string[]
}

export function validateTour(
  tour: DeliveryTour,
  options?: { now?: Date; vehicles?: Vehicle[] },
): TourValidationResult {
  const errors: string[] = []
  const { execution_mode, vehicle_id, driver_id, livreur_user_id, assigned_by_transporter_user_id,
    transporter_org_id, started_at, closed_at } = tour
  const now = options?.now ?? new Date()
  const vehicles = options?.vehicles ?? []

  if (
    execution_mode === 'INTERNAL' &&
    (!vehicle_id || !driver_id || !livreur_user_id)
  ) {
    errors.push(
      `chk_tournee_internal: an INTERNAL tournee must have vehicle_id, driver_id and livreur_user_id`,
    )
  }

  if (execution_mode === 'EXTERNAL' && !transporter_org_id) {
    errors.push(`chk_tournee_external: an EXTERNAL tournee must be assigned to a transporter_org_id`)
  }

  if (execution_mode === 'INTERNAL' && assigned_by_transporter_user_id) {
    errors.push(
      `chk_tournee_no_double_assign: an INTERNAL tournee must not be assigned by a transporter user`,
    )
  }

  if (started_at && closed_at && new Date(started_at) > new Date(closed_at)) {
    errors.push(`chk_tournee_dates: closed_at must not precede started_at`)
  }

  if (tour.type === 'VRAC' && tour.vehicle_id && vehicles.length > 0) {
    const vehicle = vehicles.find((v) => v.id === tour.vehicle_id)
    if (!vehicle) {
      errors.push(`chk_certificat_vrac: VRAC vehicle ${tour.vehicle_id} introuvable`)
    } else {
      const expiry = vehicle.certificate_expiry_at
        ? new Date(vehicle.certificate_expiry_at)
        : null
      const expired =
        !vehicle.certificate_number || !expiry || Number.isNaN(expiry.getTime())
          ? false
          : expiry.getTime() < now.getTime()
      const missing =
        !vehicle.certificate_number || !vehicle.certificate_expiry_at
      if (missing) {
        errors.push(
          `chk_certificat_vrac: VRAC vehicle ${vehicle.license_plate} requires a certificat de jaugement`,
        )
      } else if (expired) {
        errors.push(
          `chk_certificat_vrac: certificat de jaugement de ${vehicle.license_plate} expiré le ${vehicle.certificate_expiry_at}`,
        )
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export interface SlaThresholds {
  transporterAckTimeoutHours: number
  unassignedAlertHours: number
}

export const TOURNE_SLA_KEYS = {
  ackTimeout: 'tournee.transporter_ack_timeout_hours',
  unassigned: 'tournee.unassigned_alert_hours',
} as const

export function resolveSlaThresholds(settings: Setting[]): SlaThresholds {
  const byKey = Object.fromEntries(settings.map((s) => [s.setting_key, s.setting_value]))
  return {
    transporterAckTimeoutHours: Number(byKey[TOURNE_SLA_KEYS.ackTimeout] ?? 4),
    unassignedAlertHours: Number(byKey[TOURNE_SLA_KEYS.unassigned] ?? 12),
  }
}

export interface TourSlaFlags {
  transporterNoAck: boolean
  unassignedTooLong: boolean
}

export function tourSlaFlags(
  tour: Pick<DeliveryTour, 'execution_mode' | 'status' | 'created_at' | 'transporter_assigned_at' | 'sent_to_transporter_at' | 'transporter_org_id'>,
  thresholds: SlaThresholds,
  now: Date = new Date(),
): TourSlaFlags {
  const { transporterAckTimeoutHours, unassignedAlertHours } = thresholds

  let transporterNoAck = false
  if (
    tour.execution_mode === 'EXTERNAL' &&
    tour.status === 'PENDINGTRANSPORTERACK' &&
    transporterAckTimeoutHours > 0
  ) {
    // Reference the moment the tour was sent to the transporter (stamped by
    // send-to-transporter), not creation: a tour may sit in DRAFT for days.
    const ref = tour.sent_to_transporter_at ?? tour.transporter_assigned_at ?? tour.created_at
    if (ref && now.getTime() - new Date(ref).getTime() > transporterAckTimeoutHours * 3_600_000) {
      transporterNoAck = true
    }
  }

  let unassignedTooLong = false
  if (
    tour.execution_mode === 'EXTERNAL' &&
    tour.status === 'DRAFT' &&
    !tour.transporter_org_id &&
    unassignedAlertHours > 0
  ) {
    if (tour.created_at && now.getTime() - new Date(tour.created_at).getTime() > unassignedAlertHours * 3_600_000) {
      unassignedTooLong = true
    }
  }

  return { transporterNoAck, unassignedTooLong }
}

export function applyAction(
  tour: DeliveryTour,
  action: TourAction,
  now: Date = new Date(),
): Pick<DeliveryTour, 'status' | 'started_at' | 'closed_at' | 'transporter_assigned_at' | 'sent_to_transporter_at'> {
  const spec = ACTION_TARGET[action]
  if (!spec.modes.includes(tour.execution_mode) || !canTransition(tour.status, spec.target, tour.execution_mode)) {
    throw new Error(`Transition interdite à l'état ${tour.status}`)
  }
  const next: Partial<DeliveryTour> = { status: spec.target }
  if (action === 'start') {
    next.started_at = tour.started_at ?? now.toISOString()
  }
  if (action === 'close') {
    next.closed_at = now.toISOString()
    if (!next.started_at) {
      next.started_at = tour.started_at ?? now.toISOString()
    }
  }
  if (action === 'acknowledge') {
    next.transporter_assigned_at = tour.transporter_assigned_at ?? now.toISOString()
  }
  if (action === 'send-to-transporter') {
    next.sent_to_transporter_at = tour.sent_to_transporter_at ?? now.toISOString()
  }
  return next as Pick<DeliveryTour, 'status' | 'started_at' | 'closed_at' | 'transporter_assigned_at' | 'sent_to_transporter_at'>
}
