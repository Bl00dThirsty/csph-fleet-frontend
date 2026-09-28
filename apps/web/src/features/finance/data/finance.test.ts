import { describe, expect, it } from 'vitest'
import { getFinanceSummary, getRedressementStatusRows } from './finance'
import type { ReconciliationView } from '@/features/reconciliations/data/reconciliations'
import type { RedressementView } from '@/features/redressements/data/redressements'

function reconciliation(partial: Partial<ReconciliationView> & Pick<ReconciliationView, 'id'>): ReconciliationView {
  return {
    reference: `REC-${partial.id}`,
    declaration_reference: 'DEC-001',
    marketeur_name: 'Marketeur Test',
    declared_volume: 100,
    tracked_volume: 98,
    volume_gap: -2,
    gap_percentage: 2,
    subsidy_impact: 50000,
    status: 'PENDING',
    status_label: 'En attente',
    verified_at: null,
    ...partial,
  }
}

function redressement(partial: Partial<RedressementView> & Pick<RedressementView, 'id' | 'status'>): RedressementView {
  return {
    reference: `RED-${partial.id}`,
    reconciliation_reference: 'REC-001',
    marketeur_name: 'Marketeur Test',
    amount: 100000,
    amount_label: '100 000 XAF',
    currency: 'XAF',
    status_label: partial.status,
    issued_at: '2026-04-01T08:00:00Z',
    due_date: null,
    paid_at: null,
    transaction_ref: null,
    ...partial,
  }
}

const reconciliations: ReconciliationView[] = [
  reconciliation({ id: 'rec-1', volume_gap: -2, gap_percentage: 2, subsidy_impact: 50000 }),
  reconciliation({ id: 'rec-2', declared_volume: 200, tracked_volume: 190, volume_gap: -10, gap_percentage: 5, subsidy_impact: 250000, status: 'VERIFIED', status_label: 'Vérifiée' }),
]

const redressements: RedressementView[] = [
  redressement({ id: 'red-1', status: 'ISSUED', amount: 100000 }),
  redressement({ id: 'red-2', status: 'PAID', amount: 60000 }),
  redressement({ id: 'red-3', status: 'WAIVED', amount: 40000 }),
]

describe('finance view-model', () => {
  it('aggregates subsidy impact and gaps', () => {
    const summary = getFinanceSummary(reconciliations, redressements)
    expect(summary.declaredVolume).toBe(300)
    expect(summary.declaredVolumeLabel).toContain('TM')
    expect(summary.totalGap).toBe(12)
    expect(summary.gapPercentage).toBeCloseTo(4, 5)
    expect(summary.subsidyImpact).toBe(300000)
    expect(summary.subsidyImpactLabel).toContain('XAF')
    expect(summary.outstanding).toBe(100000)
    expect(summary.collected).toBe(60000)
    expect(summary.collectedLabel).toContain('XAF')
    // Tolerance 2.5 flags only the 5 % gap row.
    expect(summary.flaggedCount).toBe(1)
    expect(summary.redressementCount).toBe(3)
    expect(summary.gapPercentage).toBeGreaterThanOrEqual(0)
  })

  it('builds one status row per redressement status with totals', () => {
    const rows = getRedressementStatusRows(redressements)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.status)).toEqual(['ISSUED', 'PAID', 'WAIVED'])
    const totalCount = rows.reduce((acc, r) => acc + r.count, 0)
    expect(totalCount).toBe(3)
    for (const row of rows) {
      expect(row.statusLabel).toBeTruthy()
      expect(row.totalLabel).toContain('XAF')
    }
    expect(rows.find((r) => r.status === 'ISSUED')?.count).toBe(1)
  })

  it('defaults to the live entity collections', () => {
    const summary = getFinanceSummary()
    expect(summary.declaredVolume).toBe(0)
    expect(summary.declaredVolumeLabel).toContain('TM')
    expect(getRedressementStatusRows()).toHaveLength(3)
  })
})
