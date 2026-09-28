import { api } from '@lpg/api-client'
import type { Organization } from '@lpg/types'

export const transporterStatusOptions = [
  { label: 'Actif', value: 'active' },
  { label: 'Inactif', value: 'inactive' },
] as const

/**
 * Empty placeholder kept for backwards compatibility with sync consumers
 * (command palette, sidebar). Pages that need a populated list should call
 * `getTransporters()` on mount and store the result.
 */
export const transporters: Organization[] = []

/**
 * Live fetch — replaces the previous `curated.organizations` seed. Returns the
 * organizations whose type is `TRANSPORTEUR`. Callers should await this and
 * keep the result in component state.
 */
export async function getTransporters(): Promise<Organization[]> {
  try {
    const res = await api.organizations.list({ type: 'TRANSPORTEUR', size: 200 })
    return ((res.data ?? []) as unknown) as Organization[]
  } catch {
    return []
  }
}

export async function getTransporterById(id: string): Promise<Organization | undefined> {
  const list = await getTransporters()
  return list.find((t) => t.id === id)
}