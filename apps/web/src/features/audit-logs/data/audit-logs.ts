import { audit_logs, curated } from '@/lib/entity-data'
import type { AuditAction, AuditLog } from '@lpg/types'

export type { AuditAction }

export interface AuditLogView {
  id: string
  action: AuditAction
  actionLabel: string
  actor: string
  resourceTable: string
  resourceId: string
  ipAddress: string
  riskScore: number
  createdAt: string
}

export const auditActionLabels: Record<AuditAction, string> = {
  LOGINSUCCESS: 'Connexion rÃ©ussie',
  LOGINFAILURE: 'Ã‰chec de connexion',
  LOGOUT: 'DÃ©connexion',
  TOKENREFRESH: 'RafraÃ®chissement de jeton',
  PASSWORDRESET: 'RÃ©initialisation de mot de passe',
  MFAENABLED: 'MFA activÃ©',
  MFADISABLED: 'MFA dÃ©sactivÃ©',
  MFACHALLENGEFAILED: 'DÃ©fi MFA Ã©chouÃ©',
  MFACHALLENGESUCCESS: 'DÃ©fi MFA rÃ©ussi',
  PERMISSIONDENIED: 'Permission refusÃ©e',
  DATAEXPORT: 'Export de donnÃ©es',
  BULKDELETE: 'Suppression en masse',
  DECLARATIONSUBMITTED: 'DÃ©claration soumise',
  RECONCILIATIONVERIFIED: 'RÃ©conciliation vÃ©rifiÃ©e',
  TOURNEECREATED: 'TournÃ©e crÃ©Ã©e',
  TOURNEEASSIGNED: 'TournÃ©e assignÃ©e',
  TOURNEESENTTOTRANSPORTER: 'TournÃ©e envoyÃ©e au transporteur',
  TOURNEEACKNOWLEDGED: 'TournÃ©e accusÃ©e',
  TOURNESTARTED: 'TournÃ©e dÃ©marrÃ©e',
  TOURNEECLOSED: 'TournÃ©e clÃ´turÃ©e',
  VEHICLECERTIFICATEEXPIRED: 'Certificat vÃ©hicule expirÃ©',
  SITESUSPENDED: 'Site suspendu',
  CLIENTCREATED: 'Client crÃ©Ã©',
  SCANEVENTRECEIVED: 'Ã‰vÃ©nement de scan reÃ§u',
  PDASYNCBULKUPLOAD: 'Chargement PDA en masse',
  ANOMALYRESOLVED: 'Anomalie rÃ©solue',
  DEVICEREMOVED: 'Dispositif retirÃ©',
  GPSPOSITIONCAPTURED: 'Position GPS capturÃ©e',
  SETTINGCHANGED: 'ParamÃ¨tre modifiÃ©',
}

const USER_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  curated.users.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim()]),
)

export function getAuditLogs(): AuditLogView[] {
  return (audit_logs as AuditLog[])
    .map((log) => ({
      id: log.id,
      action: log.action,
      actionLabel: auditActionLabels[log.action] ?? log.action,
      actor: log.user_id ? (USER_NAME_BY_ID[log.user_id] ?? log.user_id) : 'SystÃ¨me',
      resourceTable: log.resource_table ?? '',
      resourceId: log.resource_id ?? '',
      ipAddress: log.ip_address ?? '',
      riskScore: log.risk_score ?? 0,
      createdAt: log.created_at ?? '',
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getAuditSummary() {
  const rows = getAuditLogs()
  return {
    total: rows.length,
    denied: rows.filter((r) => r.action === 'PERMISSIONDENIED').length,
    highRisk: rows.filter((r) => r.riskScore >= 60).length,
  }
}