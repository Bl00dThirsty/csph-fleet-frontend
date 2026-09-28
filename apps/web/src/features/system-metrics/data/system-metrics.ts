/**
 * system-metrics — stubbed. Live metrics now arrive via the system-metrics
 * store which is hydrated from api.*.list() calls. Until each backend
 * analytics endpoint is wired, the cards render zero values.
 */

export interface MetricCard {
  id: string
  label: string
  value: string
  unit: string
  hint: string
}

export function getSystemMetrics(): MetricCard[] {
  return [
    { id: 'tours', label: 'Tournées', value: '—', unit: 'total', hint: 'chargement' },
    { id: 'scans', label: 'Scans', value: '—', unit: 'événements', hint: 'chargement' },
    { id: 'devices', label: 'Appareils', value: '—', unit: 'dispositifs', hint: 'chargement' },
    { id: 'traceability', label: 'Traçabilité', value: '—%', unit: 'volume', hint: 'chargement' },
    { id: 'anomalies', label: 'Anomalies', value: '—', unit: 'ouvertes', hint: 'chargement' },
    { id: 'gap', label: 'Écart volume', value: '—', unit: 'TM', hint: 'chargement' },
  ]
}

export function getMetricGroups(): { operations: Array<{ key: string; value: number }>; health: Array<{ key: string; value: number }> } {
  return {
    operations: [
      { key: 'tournées', value: 0 },
      { key: 'scans', value: 0 },
      { key: 'déclarations suivies', value: 0 },
    ],
    health: [
      { key: 'appareils', value: 0 },
      { key: 'anomalies ouvertes', value: 0 },
      { key: 'écart TM', value: 0 },
    ],
  }
}