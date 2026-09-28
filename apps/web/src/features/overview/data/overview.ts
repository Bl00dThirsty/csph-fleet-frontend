/**
 * Role-aware "Vue d'ensemble" KPI builder.
 *
 * Legacy: derived counters from the analytics selectors over the curated
 * fixtures. Now: the page fetches live counters via api.*.list() calls and
 * passes them in via the `analytics` parameter. Empty analytics => zeroed
 * KPI cards, which is the correct placeholder while live counters load.
 */

import type { Role } from '@lpg/permissions'
import { formatTm } from '@/features/map/utils/format'

export type OverviewCard = {
  id: string
  label: string
  value: number | string
  detail: string
}

/**
 * Live analytics view — pages assemble this from api.*.list() results
 * (api.tours.list, api.devices.list, api.anomalies.list, etc.) and pass it
 * in. All fields default to zero so missing stores don't break the page.
 */
export interface LiveAnalytics {
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

const zeroAnalytics: LiveAnalytics = {
  organizations: { total: 0, active: 0 },
  users: { total: 0, active: 0 },
  sites: { total: 0, active: 0, verified: 0 },
  tours: { total: 0, inFlight: 0, planned: 0, awaitingTransporter: 0 },
  devices: { total: 0, attention: { length: 0 }, byStatus: {} },
  anomalies: { open: 0, total: 0 },
  reconciliations: { total: 0, totalGap: 0 },
  checkpoints: { total: 0, missed: 0 },
  traceability: { traceabilityRate: 0, declaredVolume: 0, trackedVolume: 0 },
}

export function buildOverview(role: Role, analytics: LiveAnalytics = zeroAnalytics): OverviewCard[] {
  const cardsByRole: Record<string, () => OverviewCard[]> = {
    SUPERADMIN: () => adminCards(analytics),
    ADMIN: () => adminCards(analytics),
    TRANSPORTEUR: () => transportCards(analytics),
    MARKETEUR: () => transportCards(analytics),
    SUPERVISOR: () => supervisorCards(analytics),
    INTEGRATEUR: () => supervisorCards(analytics),
    AGENT: () => agentCards(analytics),
  }

  const build = cardsByRole[role]
  return build ? build() : defaultCards(analytics)
}

function adminCards(a: LiveAnalytics): OverviewCard[] {
  return [
    {
      id: 'organizations',
      label: 'Organisations',
      value: `${a.organizations.active}/${a.organizations.total}`,
      detail: 'actives sur le réseau GPL',
    },
    {
      id: 'users',
      label: 'Utilisateurs',
      value: a.users.active,
      detail: `actifs sur ${a.users.total} comptes totaux`,
    },
    {
      id: 'sites',
      label: 'Sites',
      value: `${a.sites.verified}/${a.sites.active}`,
      detail: 'sites vérifiés et actifs',
    },
    {
      id: 'tours',
      label: 'Tournées',
      value: a.tours.inFlight,
      detail: `en vol · ${a.tours.planned} planifiées`,
    },
    {
      id: 'anomalies',
      label: 'Anomalies ouvertes',
      value: a.anomalies.open,
      detail: `sur ${a.anomalies.total} anomalies détectées`,
    },
    {
      id: 'reconciliations',
      label: 'Réconciliations',
      value: a.reconciliations.total,
      detail: `écart cumulé ${formatTm(a.reconciliations.totalGap)}`,
    },
  ]
}

function transportCards(a: LiveAnalytics): OverviewCard[] {
  return [
    {
      id: 'tours-in-flight',
      label: 'Tournées en vol',
      value: a.tours.inFlight,
      detail: `sur ${a.tours.total} tournées totales`,
    },
    {
      id: 'tours-awaiting',
      label: 'À confirmer transporteur',
      value: a.tours.awaitingTransporter,
      detail: 'tournées en attente de validation',
    },
    {
      id: 'devices',
      label: 'Véhicules & appareils',
      value: a.devices.total,
      detail: 'capteurs et PDA actifs sur la flotte',
    },
    {
      id: 'traceability',
      label: 'Taux de traçabilité',
      value: `${Math.round(a.traceability.traceabilityRate * 100)}%`,
      detail: `volume tracé vs ${formatTm(a.traceability.declaredVolume)} déclaré`,
    },
  ]
}

function supervisorCards(a: LiveAnalytics): OverviewCard[] {
  return [
    {
      id: 'devices-total',
      label: 'Appareils',
      value: a.devices.total,
      detail: 'appareils enregistrés sur le parc',
    },
    {
      id: 'devices-offline',
      label: 'Appareils à attention',
      value: a.devices.attention.length,
      detail: 'batterie critique ou hors ligne',
    },
    {
      id: 'devices-online',
      label: 'Appareils en ligne',
      value: a.devices.byStatus['ONLINE'] ?? 0,
      detail: 'connectés et synchronisés',
    },
    {
      id: 'checkpoints',
      label: 'Points de contrôle',
      value: a.checkpoints.total,
      detail: `${a.checkpoints.missed} manqués`,
    },
  ]
}

function agentCards(a: LiveAnalytics): OverviewCard[] {
  return [
    {
      id: 'sites-active',
      label: 'Sites actifs',
      value: a.sites.active,
      detail: `sur ${a.sites.total} sites du réseau`,
    },
    {
      id: 'sites-verified',
      label: 'Sites vérifiés',
      value: a.sites.verified,
      detail: 'sites conformes et vérifiés',
    },
    {
      id: 'reconciliations-gap',
      label: 'Écart de réconciliation',
      value: formatTm(a.reconciliations.totalGap),
      detail: `${a.reconciliations.total} réconciliations à traiter`,
    },
    {
      id: 'declared-vs-tracked',
      label: 'Déclaré vs tracé',
      value: `${Math.round(a.traceability.traceabilityRate * 100)}%`,
      detail: `tracé · écart ${formatTm(
        a.traceability.declaredVolume - a.traceability.trackedVolume,
      )}`,
    },
  ]
}

function defaultCards(a: LiveAnalytics): OverviewCard[] {
  return [
    {
      id: 'organizations',
      label: 'Organisations',
      value: a.organizations.total,
      detail: `${a.organizations.active} actives`,
    },
    {
      id: 'tours-in-flight',
      label: 'Tournées en vol',
      value: a.tours.inFlight,
      detail: `${a.tours.planned} planifiées`,
    },
    {
      id: 'traceability',
      label: 'Taux de traçabilité',
      value: `${Math.round(a.traceability.traceabilityRate * 100)}%`,
      detail: 'volume tracé vs déclaré',
    },
  ]
}

export function getOverviewCards(role: Role, analytics?: LiveAnalytics): OverviewCard[] {
  return buildOverview(role, analytics)
}