import { anomalies, anomaly_assignments, organizations, sites, client_sites, vehicles, users } from '@/lib/entity-data'
import type {
  AnomalyCategory,
  AnomalyStatus,
  AnomalyType,
  RiskEntityType,
  RiskLevel,
} from '@lpg/types'

export type { AnomalyCategory, AnomalyStatus, AnomalyType, RiskEntityType, RiskLevel }

export type AnomalyTrack = 'ALL' | 'INVESTIGATION' | 'TECHNICAL'

export interface AnomalyView {
  id: string
  reference: string
  type: AnomalyType
  type_label: string
  category: AnomalyCategory
  category_label: string
  severity: RiskLevel
  severity_label: string
  status: AnomalyStatus
  status_label: string
  entity_type: RiskEntityType | null
  entity_name: string
  assigned_agent: string | null
  created_at: string
  resolved_at: string | null
}

export const anomalyTypeLabels: Record<AnomalyType, string> = {
  VOLUMEGAP: 'Ã‰cart de volume',
  DEVIATIONROUTE: 'DÃ©viation d\'itinÃ©raire',
  CHECKPOINTMISSED: 'Point de contrÃ´le manquÃ©',
  SCANOUTOFSEQUENCE: 'Scan hors sÃ©quence',
  SIPHONNAGE: 'Siphonnage suspectÃ©',
  SUBSTITUTIONBOUTEILLES: 'Substitution bouteilles',
  FALSIFICATIONPREUVES: 'Falsification de preuves',
  FILLINGILLEGAL: 'Remplissage illÃ©gal',
  DIVERSIONSUBSIDIES: 'DÃ©tournement subventions',
  PDAUNSYNCED: 'PDA non synchronisÃ©',
  BATTERYCRITICAL: 'Batterie critique',
  GPSFAILURE: 'Panne GPS',
  KAFKATIMEOUT: 'Timeout Kafka',
  IOTDEGRADATION: 'DÃ©gradation IoT',
  SERVERUNAVAILABLE: 'Serveur indisponible',
  TOURNEEUNASSIGNEDTOOLONG: 'TournÃ©e non assignÃ©e',
  TRANSPORTERNOACK: 'AccusÃ© transporteur absent',
  GPSREMOVED: 'GPS retirÃ©',
  DEVICEOFFLINE: 'Appareil hors ligne',
}

export const anomalyCategoryLabels: Record<AnomalyCategory, string> = {
  INVESTIGATION: 'Investigation',
  TECHNICAL: 'Technique',
}

export const anomalyStatusLabels: Record<AnomalyStatus, string> = {
  NOUVEAU: 'Nouveau',
  ENCOURS: 'En cours',
  RESOLU: 'RÃ©solu',
  FERME: 'FermÃ©',
}

export const severityLabels: Record<RiskLevel, string> = {
  FAIBLE: 'Faible',
  MODERE: 'ModÃ©rÃ©',
  ELEVE: 'Ã‰levÃ©',
  CRITIQUE: 'Critique',
  CRITIQUEEXTREME: 'Critique extrÃªme',
}

export const entityTypeLabels: Record<RiskEntityType, string> = {
  MARKETEUR: 'Marketeur',
  TRANSPORTEUR: 'Transporteur',
  LIVREUR: 'Livreur',
  SITE: 'Site',
  TOURNEE: 'TournÃ©e',
  CLIENT: 'Client',
  CLIENTSITE: 'Site client',
  VEHICLE: 'VÃ©hicule',
}

export const anomalyStatusOptions: readonly { label: string; value: AnomalyStatus }[] = (
  Object.keys(anomalyStatusLabels) as AnomalyStatus[]
).map((value) => ({ label: anomalyStatusLabels[value], value }))

function entityName(entityType: RiskEntityType | null, entityId: string | null): string {
  if (!entityId) return 'â€”'
  switch (entityType) {
    case 'SITE':
      return [...sites, ...client_sites].find((s) => s.id === entityId)?.name ?? entityId
    case 'VEHICLE':
      return vehicles.find((v) => v.id === entityId)?.license_plate ?? entityId
    default:
      return organizations.find((o) => o.id === entityId)?.name ?? entityId
  }
}

export function getAnomalies(track: AnomalyTrack = 'ALL'): AnomalyView[] {
  const assignmentByAnomaly = new Map(
    anomaly_assignments
      .slice()
      .sort((a, b) => (b.assigned_at ?? '').localeCompare(a.assigned_at ?? ''))
      .map((a) => [a.anomaly_id, a]),
  )

  const rows = anomalies
    .filter((a) => track === 'ALL' || a.category === track)
    .map((a, i) => {
      const agent = assignmentByAnomaly.get(a.id)
      const agentUser = agent ? users.find((u) => u.id === agent.assigned_to_user_id) : undefined
      return {
        id: a.id,
        reference: `ANM-${String(i + 1).padStart(3, '0')}`,
        type: a.type,
        type_label: anomalyTypeLabels[a.type] ?? a.type,
        category: a.category,
        category_label: anomalyCategoryLabels[a.category],
        severity: a.severity,
        severity_label: severityLabels[a.severity],
        status: a.status,
        status_label: anomalyStatusLabels[a.status],
        entity_type: a.entity_type ?? null,
        entity_name: entityName(a.entity_type ?? null, a.entity_id ?? null),
        assigned_agent: agentUser ? `${agentUser.first_name} ${agentUser.last_name}`.trim() : null,
        created_at: a.created_at ?? '',
        resolved_at: a.resolved_at ?? null,
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return rows
}

export function getAnomalySummary(rows: AnomalyView[]) {
  return {
    total: rows.length,
    nouveau: rows.filter((r) => r.status === 'NOUVEAU').length,
    encours: rows.filter((r) => r.status === 'ENCOURS').length,
    resolu: rows.filter((r) => r.status === 'RESOLU').length,
    ferme: rows.filter((r) => r.status === 'FERME').length,
    critiques: rows.filter((r) => r.severity === 'CRITIQUE' || r.severity === 'CRITIQUEEXTREME').length,
  }
}