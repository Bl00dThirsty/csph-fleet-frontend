import { describe, expect, it } from 'vitest'
import type { Client, ClientSite, Organization } from '@lpg/types'
import { getClients, getClientSites, clientStatusLabel } from './clients'

const orgs: Organization[] = [
  { id: 'org-a', name: 'Client A', type: 'CLIENT', is_active: true },
  { id: 'org-b', name: 'Client B', type: 'CLIENT', is_active: true },
]

const clients: Client[] = [
  {
    id: 'client-1',
    org_id: 'org-a',
    primary_contact_name: 'Awa N.',
    primary_contact_phone: '+237600000001',
    primary_contact_email: 'awa@example.cm',
    is_active: true,
  },
  { id: 'client-2', org_id: 'org-b', is_active: false },
]

const sites: ClientSite[] = [
  { id: 'site-a1', client_org_id: 'org-a', region: 'CENTRE', name: 'Site A1', is_verified: true, is_active: true },
  { id: 'site-a2', client_org_id: 'org-a', region: 'LITTORAL', name: 'Site A2', is_verified: false, is_active: false },
  { id: 'site-b1', client_org_id: 'org-b', region: 'NORD', name: 'Site B1', is_verified: false, is_active: true },
]

describe('clients view-model', () => {
  it('maps each client with its linked site count (join on org FK)', () => {
    const rows = getClients(clients, orgs, sites)
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'client-1', name: 'Client A', clientSiteCount: 2 }),
        expect.objectContaining({ id: 'client-2', name: 'Client B', clientSiteCount: 1 }),
      ]),
    )
    expect(rows.reduce((acc, c) => acc + c.clientSiteCount, 0)).toBe(3)
  })

  it('derives region from the first linked site and status from is_active', () => {
    const rows = getClients(clients, orgs, sites)
    expect(rows.find((r) => r.id === 'client-1')).toMatchObject({ region: 'CENTRE', status: 'ACTIVE' })
    expect(rows.find((r) => r.id === 'client-2')).toMatchObject({ region: 'NORD', status: 'INACTIVE' })
  })

  it('falls back when org or contact details are missing', () => {
    const rows = getClients(
      [{ id: 'client-x', org_id: 'org-missing', is_active: true }],
      orgs,
      [],
    )
    expect(rows[0]).toMatchObject({
      name: '—',
      contactName: '—',
      region: 'CENTRE',
      clientSiteCount: 0,
    })
  })

  it('returns the client sites a client owns (matched on org FK)', () => {
    const rows = getClientSites('org-a', sites)
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'site-a1', status: 'ACTIVE', verified: true }),
        expect.objectContaining({ id: 'site-a2', status: 'INACTIVE', verified: false }),
      ]),
    )
  })

  it('returns no rows from the empty pre-hydration collections by default', () => {
    expect(getClients()).toEqual([])
    expect(getClientSites('org-a')).toEqual([])
  })

  it('labels statuses in French', () => {
    expect(clientStatusLabel('ACTIVE')).toBe('Actif')
    expect(clientStatusLabel('INACTIVE')).toBe('Inactif')
  })
})
