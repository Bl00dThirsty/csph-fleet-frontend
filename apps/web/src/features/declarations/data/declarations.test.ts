import { describe, expect, it } from 'vitest'
import { getDeclarations, getDeclarationSummary, declarationStatusLabels } from './declarations'
import type { Declaration, Organization } from '@lpg/types'

const orgs: Organization[] = [
  { id: 'org-a', name: 'Marketeur Test A', type: 'MARKETEUR', is_active: true },
  { id: 'org-b', name: 'Marketeur Test B', type: 'MARKETEUR', is_active: true },
]

const source: Declaration[] = [
  {
    id: 'decl-1',
    marketeur_org_id: 'org-a',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    declared_volume: 100,
    status: 'DRAFT',
    created_at: '2026-04-01T08:00:00Z',
  },
  {
    id: 'decl-2',
    marketeur_org_id: 'org-b',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    declared_volume: 50,
    status: 'SUBMITTED',
    created_at: '2026-04-02T08:00:00Z',
  },
  {
    id: 'decl-3',
    marketeur_org_id: 'org-a',
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    declared_volume: 80,
    status: 'RECONCILED',
    created_at: '2026-03-01T08:00:00Z',
    updated_at: '2026-03-05T08:00:00Z',
  },
  {
    id: 'decl-4',
    marketeur_org_id: 'org-unknown',
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    declared_volume: 10,
    status: 'DISPUTED',
    created_at: '2026-03-02T08:00:00Z',
  },
]

describe('declarations view-model', () => {
  it('returns all declarations with resolved org and labels', () => {
    const rows = getDeclarations(source, orgs)
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(row.marketeur_name).toBeTruthy()
      expect(row.status_label).toBeTruthy()
      expect(row.period).toMatch(/ au /)
      expect(row.volume_label).toContain('TM')
    }
    // Resolves known orgs, falls back to the raw id otherwise.
    expect(rows.find((r) => r.id === 'decl-1')?.marketeur_name).toBe('Marketeur Test A')
    expect(rows.find((r) => r.id === 'decl-4')?.marketeur_name).toBe('org-unknown')
    // Sorted newest first by submission date.
    expect(rows.map((r) => r.id)).toEqual(['decl-2', 'decl-1', 'decl-4', 'decl-3'])
    expect(rows[0]?.reference).toBe('DEC-002')
    // Only reconciled rows carry a reconciliation date.
    expect(rows.find((r) => r.id === 'decl-3')?.reconciled_at).toBe('2026-03-05T08:00:00Z')
    expect(rows.find((r) => r.id === 'decl-1')?.reconciled_at).toBeNull()
  })

  it('labels every status', () => {
    expect(declarationStatusLabels.DRAFT).toBeTruthy()
    expect(declarationStatusLabels.SUBMITTED).toBeTruthy()
    expect(declarationStatusLabels.RECONCILED).toBeTruthy()
    expect(declarationStatusLabels.DISPUTED).toBeTruthy()
  })

  it('summarizes buckets', () => {
    const summary = getDeclarationSummary(getDeclarations(source, orgs))
    expect(summary).toEqual({ total: 4, draft: 1, submitted: 1, reconciled: 1, disputed: 1 })
    const sum = summary.draft + summary.submitted + summary.reconciled + summary.disputed
    expect(sum).toBe(summary.total)
  })

  it('defaults to the live entity collections', () => {
    expect(getDeclarations()).toEqual([])
    expect(getDeclarationSummary(getDeclarations())).toEqual({
      total: 0,
      draft: 0,
      submitted: 0,
      reconciled: 0,
      disputed: 0,
    })
  })
})
