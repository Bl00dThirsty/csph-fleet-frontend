/**
 * Typed accessors for the curated fixture collection.
 *
 * All collections are now empty arrays. Live data flows exclusively through
 * `@lpg/api-client` (HTTP adapter → Spring Boot backend). The stores under
 * `apps/web/src/store/` call `api.*.list()` to populate themselves on mount.
 */

import { curated } from './curated.ts'
import type {
  Anomaly,
  AnomalyAssignment,
  Checkpoint,
  Client,
  ClientSite,
  Declaration,
  Device,
  Driver,
  Notification,
  NotificationGroup,
  NotificationGroupMember,
  NotificationRule,
  Organization,
  PickupRequest,
  DeliveryTour as DeliveryTourEntity,
  Reconciliation,
  Redressement,
  RiskScore,
  ScanEvent,
  Site,
  TransporterContract,
  Vehicle,
  UserMfa,
  IntegrationAuth,
  AppUser,
  SystemRole,
  Permission,
  RegionEntity as RegionEntityRow,
  Setting,
  Report,
  AuditLog,
  RfidTag,
  CustomRole,
  UserCustomRole,
} from '@lpg/types'

const organizations = curated.organizations as Organization[]
const users = curated.users as AppUser[]
const sites = curated.sites as Site[]
const clients = curated.clients as Client[]
const client_sites = curated.client_sites as ClientSite[]
const vehicles = curated.vehicles as Vehicle[]
const drivers = curated.drivers as Driver[]
const devices = curated.devices as Device[]
const transporter_contracts = curated.transporter_contracts as TransporterContract[]
const pickup_requests = curated.pickup_requests as PickupRequest[]
const delivery_tours = curated.delivery_tours as DeliveryTourEntity[]
const checkpoints = curated.checkpoints as Checkpoint[]
const scan_events = curated.scan_events as ScanEvent[]
const declarations = curated.declarations as Declaration[]
const reconciliations = curated.reconciliations as Reconciliation[]
const redressements = curated.redressements as Redressement[]
const risk_scores = curated.risk_scores as RiskScore[]
const anomalies = curated.anomalies as Anomaly[]
const anomaly_assignments = curated.anomaly_assignments as AnomalyAssignment[]
const notification_groups = curated.notification_groups as NotificationGroup[]
const notification_group_members = curated.notification_group_members as NotificationGroupMember[]
const notification_rules = curated.notification_rules as NotificationRule[]
const notifications = curated.notifications as Notification[]
const user_mfa = curated.user_mfa as unknown as UserMfa[]
const integration_auth = curated.integration_auth as unknown as IntegrationAuth[]
const system_roles = curated.system_roles as SystemRole[]
const permissions = curated.permissions as Permission[]
const regions = curated.regions as unknown as RegionEntityRow[]
const settings = curated.settings as Setting[]
const reports = curated.reports as Report[]
const audit_logs = curated.audit_logs as AuditLog[]
const rfid_tags = curated.rfid_tags as RfidTag[]
const custom_roles = curated.custom_roles as CustomRole[]
const user_custom_roles = curated.user_custom_roles as UserCustomRole[]

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
}