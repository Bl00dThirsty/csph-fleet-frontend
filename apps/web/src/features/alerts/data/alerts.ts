/**
 * alerts — stubbed. The legacy module derived infra alerts from
 * deviceStats().attention + anomalies. With curated fixtures neutered both
 * lists are empty; live alerts arrive from api.devices.list + api.anomalies.list
 * once the corresponding stores hydrate.
 */

import { getAnomalies, severityLabels } from '@/features/anomalies/data/anomalies'

export interface InfraAlert {
  id: string
  title: string
  source: 'DEVICE' | 'ANOMALY' | 'SYSTEM'
  severity: string
  severityLabel: string
  detail: string
}

export function getInfraAlerts(): InfraAlert[] {
  const anomalyAlerts: InfraAlert[] = getAnomalies('ALL')
    .filter((a) => a.status !== 'RESOLU')
    .slice(0, 6)
    .map((a) => ({
      id: `anomaly-${a.id}`,
      title: a.reference,
      source: 'ANOMALY',
      severity: a.severity,
      severityLabel: severityLabels[a.severity] ?? a.severity,
      detail: a.entity_name,
    }))

  return anomalyAlerts
}

export function getInfraAlertSummary() {
  const all = getInfraAlerts()
  return {
    total: all.length,
    critical: all.filter((a) => a.severity === 'CRITIQUE' || a.severity === 'CRITIQUEEXTREME').length,
    degraded: all.filter((a) => a.severity === 'ELEVE').length,
    warning: all.filter((a) => a.severity === 'MODERE').length,
  }
}