import { curated } from '@/lib/entity-data'
import type { Organization } from '@lpg/types'

export const marketerStatusOptions = [
  { label: 'Actif', value: 'active' },
  { label: 'Inactif', value: 'inactive' },
]

export function getMarketers(): Organization[] {
  const orgs = curated.organizations as Organization[]
  return orgs.filter((o) => o.type === 'MARKETEUR')
}

export const marketers: Organization[] = getMarketers()

export function getMarketerById(id: string): Organization | undefined {
  return marketers.find((m) => m.id === id)
}

export function getMarketerByName(name: string): Organization | undefined {
  // Try exact match first, then partial match on the name
  return marketers.find(
    (m) =>
      m.name.includes(name) || (m.registration_number && m.registration_number.includes(name))
  )
}