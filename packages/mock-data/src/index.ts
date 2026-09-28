/**
 * @lpg/mock-data — STUB package.
 *
 * See ./curated.ts for the full explanation. This file re-exports the
 * empty collections + types so legacy imports keep compiling.
 */

import { curated } from './curated.ts'

export { curated } from './curated.ts'
export {
  organizations,
  users,
  sites,
  clients,
  client_sites,
  vehicles,
  drivers,
  devices,
  transporter_contracts,
  pickup_requests,
  delivery_tours,
  checkpoints,
  scan_events,
  declarations,
  reconciliations,
  redressements,
  risk_scores,
  anomalies,
  anomaly_assignments,
  notification_groups,
  notification_group_members,
  notification_rules,
  notifications,
  user_mfa,
  integration_auth,
  system_roles,
  permissions,
  regions,
  settings,
  reports,
  audit_logs,
  rfid_tags,
  custom_roles,
  user_custom_roles,
} from './entities.ts'

export type {
  Region,
  Organization,
  SystemRole,
  Permission,
  User,
  Site,
  Client,
  ClientSite,
  Vehicle,
  Driver,
  Device,
  TransporterContract,
  PickupRequest,
  DeliveryTour,
  Checkpoint,
  ScanEvent,
  Declaration,
  Reconciliation,
  Redressement,
  RiskScore,
  Anomaly,
  AnomalyAssignment,
  NotificationGroup,
  NotificationGroupMember,
  NotificationRule,
  Notification,
  CuratedFixtures,
} from './curated.ts'

export type {
  Setting,
  Report,
  AuditLog,
  RfidTag,
  CustomRole,
  UserCustomRole,
} from '@lpg/types'

/**
 * Settings helpers stay — they read from the (now empty) `curated.settings`. When
 * the api.settings endpoint is wired in, swap these to fetch live values.
 */
export function getSetting(key: string): string | null {
  const setting = curated.settings.find((s) => (s as { setting_key?: string }).setting_key === key)
  const value = (setting as { setting_value?: string | number | null } | undefined)?.setting_value
  return typeof value === 'string' ? value : value === undefined || value === null ? null : String(value)
}

export function getSettingNumber(key: string): number | null {
  const raw = getSetting(key)
  if (raw === null || raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

/** Auth fixtures — empty. Backend now provisions auth via /users/with-auth. */
export interface AuthFixture {
  id: string
  email: string
  first_name: string
  last_name: string
  system_role: string
  password: string
  org_id: string
  org_name: string
}

export const AUTH_FIXTURES: AuthFixture[] = []

export interface FakeProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  system_role: string
  org_id: string
  org_name: string
}

export const fakeProfiles: FakeProfile[] = []

/**
 * Analytics — stubbed. The legacy analytics module computed counts from the
 * curated fixture collections; with those neutered to empty arrays there is
 * nothing to compute, so the result is a zeroed-out shell. Live analytics
 * arrives through `api.*.list()` once the corresponding store is hydrated.
 */
export interface Analytics {
  organizations: { total: number; active: number }
  users: { total: number; active: number }
  sites: { total: number; active: number; verified: number }
  tours: {
    total: number
    inFlight: number
    planned: number
    awaitingTransporter: number
  }
  devices: {
    total: number
    attention: { length: number }
    byStatus: Record<string, number>
  }
  anomalies: { open: number; total: number }
  reconciliations: { total: number; totalGap: number }
  checkpoints: { total: number; missed: number }
  traceability: { traceabilityRate: number; declaredVolume: number; trackedVolume: number }
}

export const buildAnalytics = (): Analytics => ({
  organizations: { total: 0, active: 0 },
  users: { total: 0, active: 0 },
  sites: { total: 0, active: 0, verified: 0 },
  tours: { total: 0, inFlight: 0, planned: 0, awaitingTransporter: 0 },
  devices: { total: 0, attention: { length: 0 }, byStatus: {} },
  anomalies: { open: 0, total: 0 },
  reconciliations: { total: 0, totalGap: 0 },
  checkpoints: { total: 0, missed: 0 },
  traceability: { traceabilityRate: 0, declaredVolume: 0, trackedVolume: 0 },
})

export function resolveAnalyticsSelector<T>(_selector: () => T): T {
  return undefined as unknown as T
}

/**
 * Device stats — stubbed. Used by alerts/device-health. Live data flows
 * through api.devices.list() and api.anomalies.list().
 */
export interface DeviceAttention {
  id: string
  serial: string
  issue: string
  battery?: number
  lastSync?: string
}
export const deviceStats = (): { attention: DeviceAttention[]; total: number; byStatus: Record<string, number> } => ({
  attention: [],
  total: 0,
  byStatus: {},
})