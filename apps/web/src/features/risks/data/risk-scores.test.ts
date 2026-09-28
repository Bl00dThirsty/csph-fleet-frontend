import { describe, expect, it } from 'vitest'
import type { Organization, RiskScore, Vehicle } from '@lpg/types'
import {
  getRiskScores,
  getRiskSummary,
  riskEntityLabels,
  riskLevelLabels,
  type RiskScoreLookups,
} from './risk-scores'

const organizations: Organization[] = [
  { id: 'org-mkt', name: 'Marketeur Test', type: 'MARKETEUR', is_active: true },
]

const vehicles: Vehicle[] = [
  {
    id: 'veh-1',
    license_plate: 'CE 123 AB',
    type: 'VRAC',
    org_id: 'org-mkt',
    is_active: true,
  },
]

const lookups: RiskScoreLookups = {
  organizations,
  sites: [],
  clientSites: [],
  vehicles,
  users: [],
}

const scores: RiskScore[] = [
  {
    id: 'rs-crit',
    entity_type: 'MARKETEUR',
    entity_id: 'org-mkt',
    score: 92,
    level: 'CRITIQUE',
    period_start: '2026-09-01T00:00:00Z',
    period_end: '2026-09-28T00:00:00Z',
    model_version: 'v1',
    details_json: { livraisons: 12 },
  },
  {
    id: 'rs-veh',
    entity_type: 'VEHICLE',
    entity_id: 'veh-1',
    score: 45,
    level: 'MODERE',
    period_start: '2026-09-01T00:00:00Z',
    period_end: '2026-09-28T00:00:00Z',
    model_version: 'v1',
  },
  {
    id: 'rs-unknown',
    entity_type: 'SITE',
    entity_id: 'site-missing',
    score: 10,
    level: 'FAIBLE',
    period_start: '2026-09-01T00:00:00Z',
    period_end: '2026-09-28T00:00:00Z',
    model_version: 'v1',
  },
]

describe('risk-scores view-model', () => {
  it('returns risk scores with resolved entities', () => {
    const rows = getRiskScores(scores, lookups)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.entity_name).toBeTruthy()
      expect(row.level_label).toBeTruthy()
      expect(row.score).toBeGreaterThanOrEqual(0)
    }
    expect(rows.find((r) => r.id === 'rs-crit')?.entity_name).toBe('Marketeur Test')
    expect(rows.find((r) => r.id === 'rs-veh')?.entity_name).toBe('CE 123 AB')
    expect(rows.find((r) => r.id === 'rs-unknown')?.entity_name).toBe('site-missing')
  })

  it('sorts by descending score', () => {
    const rows = getRiskScores(scores, lookups)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.score >= rows[i]!.score).toBe(true)
    }
    expect(rows[0]?.id).toBe('rs-crit')
  })

  it('summarizes level buckets', () => {
    const summary = getRiskSummary(getRiskScores(scores, lookups))
    const sum = summary.faible + summary.modere + summary.eleve + summary.critique
    expect(sum).toBe(summary.total)
    expect(summary.total).toBe(3)
    expect(summary.faible).toBe(1)
    expect(summary.modere).toBe(1)
    expect(summary.critique).toBe(1)
    expect(summary.average).toBeGreaterThanOrEqual(0)
  })

  it('defaults to the (empty) entity-data collections', () => {
    expect(getRiskScores()).toEqual([])
  })

  it('labels every risk level and entity', () => {
    expect(riskLevelLabels.CRITIQUE).toBe('Critique')
    expect(riskLevelLabels.MODERE).toBe('Modéré')
    expect(riskEntityLabels.MARKETEUR).toBe('Marketeur')
    expect(riskEntityLabels.TOURNEE).toBe('Tournée')
    expect(riskEntityLabels.VEHICLE).toBe('Véhicule')
  })
})
