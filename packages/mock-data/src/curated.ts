/**
 * @lpg/mock-data — STUB package.
 *
 * Every curated seed has been removed. The web app is now wired 100% to the
 * Spring Boot backend (`@lpg/api-client` → http://localhost:8080/api/v1).
 *
 * This stub remains in the workspace ONLY so the 60+ legacy feature files
 * that still import `@lpg/mock-data` keep compiling. They render "no data"
 * until the relevant store under `apps/web/src/store/` fetches live rows
 * over the wire (api.users.list, api.organizations.list, etc.).
 *
 * When the next pass of feature cleanup completes, this stub can be removed
 * and the imports updated to point directly at `@lpg/api-client` + the live
 * stores.
 */

import type {
  Region,
  Organization,
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
  SystemRole,
  Permission,
} from '@lpg/types'

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
}

export interface CuratedFixtures {
  organizations: Organization[]
  users: User[]
  sites: Site[]
  client_sites: ClientSite[]
  vehicles: Vehicle[]
  drivers: Driver[]
  devices: Device[]
  transporter_contracts: TransporterContract[]
  pickup_requests: PickupRequest[]
  delivery_tours: DeliveryTour[]
  checkpoints: Checkpoint[]
  scan_events: ScanEvent[]
  declarations: Declaration[]
  reconciliations: Reconciliation[]
  redressements: Redressement[]
  risk_scores: RiskScore[]
  anomalies: Anomaly[]
  anomaly_assignments: AnomalyAssignment[]
  notification_groups: NotificationGroup[]
  notification_group_members: NotificationGroupMember[]
  notification_rules: NotificationRule[]
  notifications: Notification[]
  rfid_tags: unknown[]
  system_roles: SystemRole[]
  permissions: Permission[]
  regions: Region[]
  settings: Array<{ setting_key: string; setting_value: string | number | null; value_type?: string }>
  reports: unknown[]
  audit_logs: unknown[]
  custom_roles: unknown[]
  user_custom_roles: unknown[]
  user_mfa: unknown[]
  integration_auth: unknown[]
  clients: unknown[]
}

const empty: CuratedFixtures = {
  organizations: [],
  users: [],
  sites: [],
  client_sites: [],
  vehicles: [],
  drivers: [],
  devices: [],
  transporter_contracts: [],
  pickup_requests: [],
  delivery_tours: [],
  checkpoints: [],
  scan_events: [],
  declarations: [],
  reconciliations: [],
  redressements: [],
  risk_scores: [],
  anomalies: [],
  anomaly_assignments: [],
  notification_groups: [],
  notification_group_members: [],
  notification_rules: [],
  notifications: [],
  rfid_tags: [],
  system_roles: [],
  permissions: [],
  regions: [],
  settings: [],
  reports: [],
  audit_logs: [],
  custom_roles: [],
  user_custom_roles: [],
  user_mfa: [],
  integration_auth: [],
  clients: [],
}

export const curated: CuratedFixtures = empty