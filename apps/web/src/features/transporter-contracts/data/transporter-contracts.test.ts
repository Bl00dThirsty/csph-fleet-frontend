import { describe, expect, it } from 'vitest'
import type { Organization, TransporterContract } from '@lpg/types'
import { getTransporterContracts, getTransporterContractSummary } from './transporter-contracts'

const orgs: Organization[] = [
  { id: 'org-t1', name: 'Transporteur 1', type: 'TRANSPORTEUR', is_active: true },
  { id: 'org-m1', name: 'Marketeur 1', type: 'MARKETEUR', is_active: true },
]

const contracts: TransporterContract[] = [
  {
    id: 'tc-older',
    contract_reference: 'CTR-2025-001',
    marketeur_org_id: 'org-m1',
    transporter_org_id: 'org-t1',
    is_primary: false,
    started_at: '2025-01-10T00:00:00Z',
    ended_at: '2025-06-10T00:00:00Z',
    is_active: false,
  },
  {
    id: 'tc-newer',
    contract_reference: 'CTR-2026-001',
    marketeur_org_id: 'org-m1',
    transporter_org_id: 'org-t1',
    is_primary: true,
    started_at: '2026-01-05T00:00:00Z',
    ended_at: null,
    is_active: true,
  },
  {
    id: 'tc-no-ref',
    marketeur_org_id: 'org-m1',
    transporter_org_id: 'org-t1',
    is_primary: false,
    started_at: '2024-03-01T00:00:00Z',
    ended_at: null,
    is_active: true,
  },
]

describe('transporter-contracts view-model', () => {
  it('returns contracts with resolved orgs, newest first', () => {
    const rows = getTransporterContracts(contracts, orgs)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.id)).toEqual(['tc-newer', 'tc-older', 'tc-no-ref'])
    for (const row of rows) {
      expect(row.marketeur_name).toBe('Marketeur 1')
      expect(row.transporter_name).toBe('Transporteur 1')
    }
  })

  it('maps references, dates and flags', () => {
    const rows = getTransporterContracts(contracts, orgs)
    expect(rows[0]).toMatchObject({
      reference: 'CTR-2026-001',
      start_date: '2026-01-05',
      end_date: null,
      is_primary: true,
      is_active: true,
    })
    expect(rows[1]).toMatchObject({ reference: 'CTR-2025-001', start_date: '2025-01-10', end_date: '2025-06-10' })
    // Falls back to the id when no contract reference exists
    expect(rows[2]).toMatchObject({ reference: 'tc-no-ref' })
  })

  it('summarizes active/primary contracts', () => {
    const summary = getTransporterContractSummary(getTransporterContracts(contracts, orgs))
    expect(summary).toEqual({ total: 3, active: 2, primary: 1, inactive: 1 })
    expect(summary.active + summary.inactive).toBe(summary.total)
  })

  it('returns no rows from the empty pre-hydration collections by default', () => {
    expect(getTransporterContracts()).toEqual([])
  })
})
