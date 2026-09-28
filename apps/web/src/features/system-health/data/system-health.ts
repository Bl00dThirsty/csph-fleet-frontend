/**
 * system-health — stubbed. The legacy module derived service health from
 * analytics counters computed against the curated fixtures. With those
 * fixtures neutered, the live health picture will come from each backend
 * service's `/actuator/health` endpoint (a follow-up pass). For now the
 * health snapshot reports "DEGRADED" with no live metrics.
 */

export interface SystemServiceHealth {
  id: string
  name: string
  status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL'
  statusLabel: string
  detail: string
}

export interface SystemHealth {
  overall: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL'
  services: SystemServiceHealth[]
  operational: number
  degraded: number
  critical: number
}

export const systemHealthLabels: Record<'OPERATIONAL' | 'DEGRADED' | 'CRITICAL', string> = {
  OPERATIONAL: 'Opérationnel',
  DEGRADED: 'Dégradé',
  CRITICAL: 'Critique',
}

function toService(
  id: string,
  name: string,
  status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL',
  detail: string,
): SystemServiceHealth {
  return {
    id,
    name,
    status,
    statusLabel: systemHealthLabels[status],
    detail,
  }
}

export function getSystemHealth(): SystemHealth {
  const services: SystemServiceHealth[] = [
    toService('tours', 'Moteur de tournées', 'DEGRADED', 'chargement en cours'),
    toService('devices', 'Flotte & dispositifs', 'DEGRADED', 'chargement en cours'),
    toService('scans', 'Réception des scans', 'DEGRADED', 'chargement en cours'),
    toService('anomalies', 'Détection d’anomalies', 'DEGRADED', 'chargement en cours'),
    toService('reconciliation', 'Réconciliation', 'DEGRADED', 'chargement en cours'),
  ]

  return {
    overall: 'DEGRADED',
    services,
    operational: 0,
    degraded: services.length,
    critical: 0,
  }
}

export function getServiceHealthSummary() {
  const health = getSystemHealth()
  return {
    total: health.services.length,
    operational: health.operational,
    degraded: health.degraded,
    critical: health.critical,
    overall: health.overall,
    overallLabel: systemHealthLabels[health.overall],
  }
}