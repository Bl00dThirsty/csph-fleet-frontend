import { describe, expect, it } from 'vitest'
import type { ClientSite, Organization } from '@lpg/types'
import { getVisitSummary, getVisits, getVisitsByRegion } from './visits'

const orgs: Pick<Organization, 'id' | 'name'>[] = [
  { id: 'org-a', name: 'Client A' },
  { id: 'org-b', name: 'Client B' },
]

const sites: ClientSite[] = [
  { id: 'site-1', client_org_id: 'org-a', region: 'CENTRE', name: 'Site A1', is_verified: true, verified_at: '2026-02-01T10:00:00Z', is_active: true },
  { id: 'site-2', client_org_id: 'org-a', region: 'LITTORAL', name: 'Site A2', is_verified: false, verified_at: null, is_active: true },
  { id: 'site-3', client_org_id: 'org-missing', region: 'NORD', name: 'Site X', is_verified: false, verified_at: null, is_active: true },
]

describe('visits view-model', () => {
  it('lists client sites with verification status and French labels', () => {
    const rows = getVisits(sites, orgs)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      siteName: 'Site A1',
      clientName: 'Client A',
      status: 'VERIFIE',
      statusLabel: 'Vérifié',
      verifiedAt: '2026-02-01T10:00:00Z',
    })
    expect(rows[1]).toMatchObject({
      status: 'PENDING',
      statusLabel: 'En attente de vérification',
      verifiedAt: null,
    })
    for (const row of rows) {
      expect(['VERIFIE', 'PENDING']).toContain(row.status)
    }
  })

  it('falls back to the org id when the org is unknown', () => {
    const rows = getVisits(sites, orgs)
    expect(rows[2]).toMatchObject({ clientName: 'org-missing' })
  })

  it('computes verified/pending summary', () => {
    const summary = getVisitSummary(sites, orgs)
    expect(summary).toEqual({ total: 3, verified: 1, pending: 2 })
    expect(summary.verified + summary.pending).toBe(summary.total)
  })

  it('groups visits by region', () => {
    expect(getVisitsByRegion(sites, orgs)).toEqual({ CENTRE: 1, LITTORAL: 1, NORD: 1 })
  })

  it('returns no rows from the empty pre-hydration collections by default', () => {
    expect(getVisits()).toEqual([])
    expect(getVisitSummary()).toEqual({ total: 0, verified: 0, pending: 0 })
    expect(getVisitsByRegion()).toEqual({})
  })
})
