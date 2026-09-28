import { describe, expect, it } from 'vitest'
import { getPasswordSummary, getPasswordUsers } from './passwords'
import type { AppUser } from '@lpg/types'

const users = [
  {
    id: 'u-1',
    email: 'admin@example.com',
    first_name: 'Amina',
    last_name: 'Ndiaye',
    system_role: 'ADMIN',
    must_change_password: true,
    last_login_at: '2026-01-01',
    locked_until: null,
  },
  {
    id: 'u-2',
    email: 'livreur@example.com',
    first_name: 'Jean',
    last_name: 'Dupont',
    system_role: 'LIVREUR',
    must_change_password: false,
    last_login_at: null,
    locked_until: '2026-02-01',
  },
  {
    id: 'u-3',
    email: 'agent@example.com',
    first_name: 'Marie',
    last_name: 'Curie',
    system_role: 'AGENT',
    last_login_at: null,
  },
] as AppUser[]

describe('passwords view-model', () => {
  it('lists users with password flags and French role labels', () => {
    const rows = getPasswordUsers(users)
    expect(rows.length).toBe(3)
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get('u-1')?.fullName).toBe('Amina Ndiaye')
    expect(byId.get('u-1')?.role).toBe('Administrateur')
    expect(byId.get('u-1')?.mustChange).toBe(true)
    expect(byId.get('u-2')?.role).toBe('Livreur')
    expect(byId.get('u-3')?.role).toBe('Agent validateur')
    for (const row of rows) {
      expect(row.email).toBeTruthy()
      expect(row.fullName).toBeTruthy()
      expect(row.role).toBeTruthy()
    }
  })

  it('computes summary consistent with list', () => {
    const summary = getPasswordSummary(users)
    expect(summary.total).toBe(getPasswordUsers(users).length)
    expect(summary.total).toBe(3)
    expect(summary.mustChange).toBe(1)
    expect(summary.locked).toBe(1)
  })

  it('returns an empty list when no source rows are provided', () => {
    expect(getPasswordUsers()).toEqual([])
  })
})
