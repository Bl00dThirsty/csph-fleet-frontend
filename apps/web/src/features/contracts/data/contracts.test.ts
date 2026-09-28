import { describe, expect, it } from 'vitest'
import type { Organization, TransporterContract } from '@lpg/types'
import { getContractSummary, getContractsByTransporter } from './contracts'

const orgs: Organization[] = [
  { id: 'org-t1', name: 'Transporteur 1', type: 'TRANSPORTEUR', is_active: true },
  { id: 'org-t2', name: 'Transporteur 2', type: 'TRANSPORTEUR', is_active: true },
  { id: 'org-m1', name: 'Marketeur 1', type: 'MARKETEUR', is_active: true },
  { id: 'org-m2', name: 'Marketeur 2', type: 'MARKETEUR', is_active: true },
]

const contracts: TransporterContract[] = [
  { id: 'tc-1', marketeur_org_id: 'org-m1', transporter_org_id: 'org-t1', is_primary: true, is_active: true },
  { id: 'tc-2', marketeur_org_id: 'org-m2', transporter_org_id: 'org-t1', is_primary: false, is_active: false },
  { id: 'tc-3', marketeur_org_id: 'org-m1', transporter_org_id: 'org-t2', is_primary: true, is_active: true },
]

describe('contracts view-model', () => {
  it('groups contracts per transporter with active/primary counts', () => {
    const rows = getContractsByTransporter(contracts, orgs)
    expect(rows).toHaveLength(2)
    const t1 = rows.find((r) => r.transporterId === 'org-t1')
    expect(t1).toMatchObject({
      transporterName: 'Transporteur 1',
      contractCount: 2,
      activeCount: 1,
      primaryCount: 1,
    })
    expect(t1?.marketeurs).toEqual(expect.arrayContaining(['Marketeur 1', 'Marketeur 2']))
    // Sorted by contract count descending
    expect(rows[0]!.contractCount).toBeGreaterThanOrEqual(rows[1]!.contractCount)
  })

  it('falls back to the org id when the org is unknown', () => {
    const rows = getContractsByTransporter(
      [{ id: 'tc-x', marketeur_org_id: 'org-m9', transporter_org_id: 'org-t9', is_primary: false, is_active: true }],
      orgs,
    )
    expect(rows[0]).toMatchObject({ transporterName: 'org-t9', marketeurs: ['org-m9'] })
  })

  it('computes summary consistent with the source rows', () => {
    const summary = getContractSummary(contracts, orgs)
    expect(summary).toEqual({ transporters: 2, totalContracts: 3, active: 2, primary: 2 })
  })

  it('returns no rows from the empty pre-hydration collections by default', () => {
    expect(getContractsByTransporter()).toEqual([])
    expect(getContractSummary()).toEqual({ transporters: 0, totalContracts: 0, active: 0, primary: 0 })
  })
})
