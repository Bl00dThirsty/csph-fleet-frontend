import { create } from 'zustand'
import { curated } from '@lpg/mock-data'
import type { Role, User as CuratedUser } from '@lpg/types'

export type UserPatch = Partial<Pick<CuratedUser,
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'system_role'
  | 'org_id'
  | 'phone'
  | 'job_title'
  | 'site_id'
  | 'custom_permissions'
  | 'is_active'
>>

interface UsersState {
  users: CuratedUser[]
  createUser: (user: Omit<CuratedUser, 'id' | 'created_at' | 'updated_at'>) => void
  updateUser: (id: string, patch: UserPatch) => void
  setStatus: (id: string, active: boolean) => void
  deleteUser: (id: string) => void
  resetPassword: (id: string) => void
  lockUntil: (id: string, iso?: string | null) => void
  unlock: (id: string) => void
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: (curated.users as CuratedUser[]).map((u) => ({ ...u })),

  createUser(user) {
    const id = `user-${crypto.randomUUID().slice(0, 8)}`
    const now = new Date().toISOString()
    set((s) => ({
      users: [{ ...user, id, created_at: now, updated_at: now } as CuratedUser, ...s.users],
    }))
  },

  updateUser(id, patch) {
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id ? { ...u, ...patch } : u,
      ),
    }))
  },

  setStatus(id, active) {
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id ? { ...u, is_active: active } : u,
      ),
    }))
  },

  deleteUser(id) {
    set((s) => ({
      users: s.users.filter((u) => u.id !== id),
    }))
  },

  resetPassword(id) {
    const u = get().users.find((x) => x.id === id)
    if (!u) return
  },

  lockUntil(id, iso) {
    const stamp = iso ?? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id ? { ...u, locked_until: stamp } : u,
      ),
    }))
  },

  unlock(id) {
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id ? { ...u, locked_until: null } : u,
      ),
    }))
  },
}))

export function listOrgsForRole(role: Role): string[] {
  const seen = new Set<string>()
  for (const u of useUsersStore.getState().users) {
    if (u.system_role === role && u.org_id) seen.add(u.org_id)
  }
  return [...seen]
}
