import {
  risk_scores,
  organizations,
  sites,
  client_sites,
  vehicles,
  users,
} from '@/lib/entity-data'
import type {
  AppUser,
  ClientSite,
  Organization,
  RiskEntityType,
  RiskLevel,
  RiskScore,
  Site,
  Vehicle,
} from '@lpg/types'

export type { RiskEntityType, RiskLevel }

export interface RiskScoreView {
  id: string
  entity_type: RiskEntityType
  entity_name: string
  score: number
  level: RiskLevel
  level_label: string
  period: string
  model_version: string
  updated_at: string
  detail: string
}

export const riskLevelLabels: Record<RiskLevel, string> = {
  FAIBLE: 'Faible',
  MODERE: 'Modéré',
  ELEVE: 'Élevé',
  CRITIQUE: 'Critique',
  CRITIQUEEXTREME: 'Critique extrême',
}

export const riskEntityLabels: Record<RiskEntityType, string> = {
  MARKETEUR: 'Marketeur',
  TRANSPORTEUR: 'Transporteur',
  LIVREUR: 'Livreur',
  SITE: 'Site',
  TOURNEE: 'Tournée',
  CLIENT: 'Client',
  CLIENTSITE: 'Site client',
  VEHICLE: 'Véhicule',
}

export const riskLevelOptions: readonly { label: string; value: RiskLevel }[] = (
  Object.keys(riskLevelLabels) as RiskLevel[]
).map((value) => ({ label: riskLevelLabels[value], value }))

export interface RiskScoreLookups {
  organizations: Organization[]
  sites: Site[]
  clientSites: ClientSite[]
  vehicles: Vehicle[]
  users: AppUser[]
}

function entityName(
  entityType: RiskEntityType,
  entityId: string,
  lookups: RiskScoreLookups,
): string {
  switch (entityType) {
    case 'SITE':
    case 'CLIENTSITE':
      return (
        [...lookups.sites, ...lookups.clientSites].find((s) => s.id === entityId)?.name ??
        entityId
      )
    case 'VEHICLE':
      return lookups.vehicles.find((v) => v.id === entityId)?.license_plate ?? entityId
    case 'LIVREUR': {
      const user = lookups.users.find((u) => u.id === entityId)
      return user ? `${user.first_name} ${user.last_name}`.trim() : entityId
    }
    default:
      return lookups.organizations.find((o) => o.id === entityId)?.name ?? entityId
  }
}

function detailText(details: Record<string, unknown> | null): string {
  if (!details) return ''
  const parts = Object.entries(details)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .map(([k, v]) => `${k}: ${v}`)
  return parts.join(', ')
}

export function getRiskScores(
  scores: RiskScore[] = risk_scores as RiskScore[],
  lookups: RiskScoreLookups = {
    organizations: organizations as Organization[],
    sites: sites as Site[],
    clientSites: client_sites as ClientSite[],
    vehicles: vehicles as Vehicle[],
    users: users as AppUser[],
  },
): RiskScoreView[] {
  return scores
    .map((r) => ({
      id: r.id,
      entity_type: r.entity_type,
      entity_name: entityName(r.entity_type, r.entity_id, lookups),
      score: r.score,
      level: r.level,
      level_label: riskLevelLabels[r.level],
      period: `${r.period_start.slice(0, 10)} au ${r.period_end.slice(0, 10)}`,
      model_version: r.model_version,
      updated_at: r.updated_at ?? r.created_at ?? '',
      detail: detailText(r.details_json ?? null),
    }))
    .sort((a, b) => b.score - a.score)
}

export function getRiskSummary(rows: RiskScoreView[]) {
  return {
    total: rows.length,
    faible: rows.filter((r) => r.level === 'FAIBLE').length,
    modere: rows.filter((r) => r.level === 'MODERE').length,
    eleve: rows.filter((r) => r.level === 'ELEVE').length,
    critique: rows.filter((r) => r.level === 'CRITIQUE' || r.level === 'CRITIQUEEXTREME').length,
    average: rows.length ? Math.round(rows.reduce((acc, r) => acc + r.score, 0) / rows.length) : 0,
  }
}