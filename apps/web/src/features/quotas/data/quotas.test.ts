import { describe, expect, it } from 'vitest'
import { getMarketeurQuotas, getQuotaSummary } from './quotas'
import type { Declaration, DeliveryTour, Organization } from '@lpg/types'

const orgs: Organization[] = [
  { id: 'org-a', name: 'Marketeur Test A', type: 'MARKETEUR', is_active: true },
  { id: 'org-b', name: 'Marketeur Test B', type: 'MARKETEUR', is_active: true },
  { id: 'org-c', name: 'Marketeur Test C', type: 'MARKETEUR', is_active: true },
]

const decls: Declaration[] = [
  { id: 'decl-1', marketeur_org_id: 'org-a', period_start: '2026-03-01', period_end: '2026-03-31', declared_volume: 100, status: 'SUBMITTED' },
  { id: 'decl-2', marketeur_org_id: 'org-a', period_start: '2026-02-01', period_end: '2026-02-28', declared_volume: 100, status: 'RECONCILED' },
  { id: 'decl-3', marketeur_org_id: 'org-b', period_start: '2026-03-01', period_end: '2026-03-31', declared_volume: 50, status: 'DRAFT' },
  { id: 'decl-4', marketeur_org_id: 'org-c', period_start: '2026-03-01', period_end: '2026-03-31', declared_volume: 0, status: 'DRAFT' },
]

function tour(id: string, marketeur_org_id: string, delivered_quantity: number | null): DeliveryTour {
  return {
    id,
    marketeur_org_id,
    execution_mode: 'INTERNAL',
    type: 'VRAC',
    status: 'CLOSED',
    requested_quantity: 20,
    delivered_quantity,
  }
}

const tours: DeliveryTour[] = [
  tour('tour-1', 'org-a', 120),
  tour('tour-2', 'org-a', 40),
  tour('tour-3', 'org-b', 25),
  tour('tour-4', 'org-b', null),
]

describe('quotas view-model', () => {
  it('computes usage per marketeur', () => {
    const rows = getMarketeurQuotas(decls, tours, orgs)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.marketeurName).toBeTruthy()
      expect(row.usageRate).toBeGreaterThanOrEqual(0)
      expect(row.usageRate).toBeLessThanOrEqual(100)
    }
    // org-a declared 200 TM and delivered 160 TM → 80 %.
    expect(rows.find((r) => r.marketeurId === 'org-a')).toMatchObject({
      marketeurName: 'Marketeur Test A',
      declaredVolume: 200,
      deliveredVolume: 160,
      usageRate: 80,
    })
    // org-b declared 50 TM and delivered 25 TM → 50 % (null delivery counts as 0).
    expect(rows.find((r) => r.marketeurId === 'org-b')).toMatchObject({
      declaredVolume: 50,
      deliveredVolume: 25,
      usageRate: 50,
    })
    // Zero allocation never divides by zero.
    expect(rows.find((r) => r.marketeurId === 'org-c')).toMatchObject({
      declaredVolume: 0,
      deliveredVolume: 0,
      usageRate: 0,
    })
  })

  it('derives summary aggregates', () => {
    const rows = getMarketeurQuotas(decls, tours, orgs)
    const summary = getQuotaSummary(rows)
    expect(summary.marketeurs).toBe(rows.length)
    expect(summary.declared).toBe(250)
    expect(summary.delivered).toBe(185)
    // 185 delivered / 250 declared → 74 %.
    expect(summary.avgUsage).toBe(74)
    expect(summary.declared).toBeGreaterThan(0)
    expect(summary.avgUsage).toBeGreaterThanOrEqual(0)
  })

  it('defaults to the live entity collections', () => {
    expect(getMarketeurQuotas()).toEqual([])
    expect(getQuotaSummary()).toEqual({ marketeurs: 0, declared: 0, delivered: 0, avgUsage: 0 })
  })
})
