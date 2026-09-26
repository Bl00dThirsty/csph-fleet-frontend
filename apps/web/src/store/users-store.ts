import { create } from 'zustand'
import { api } from '@lpg/api-client'
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

interface CreateDriverPayload {
  firstName: string
  lastName: string
  email: string
  username: string
  password: string
  organizationId: string
  orgId: string
  primarySiteId?: string
  title?: string
  jobCode?: string
  primaryPhone?: string
  roleName?: string
}

interface UsersState {
  users: CuratedUser[]
  isLoading: boolean
  error: string | null
  fetchUsers: () => Promise<void>
  createUser: (user: Omit<CuratedUser, 'id' | 'created_at' | 'updated_at'>) => void
  createDriver: (payload: CreateDriverPayload) => Promise<void>
  updateUser: (id: string, patch: UserPatch) => void
  setStatus: (id: string, active: boolean) => void
  deleteUser: (id: string) => void
  resetPassword: (id: string) => void
  lockUntil: (id: string, iso?: string | null) => void
  unlock: (id: string) => void
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: (curated.users as CuratedUser[]).map((u) => ({ ...u })),
  isLoading: false,
  error: null,

  async fetchUsers() {
    set({ isLoading: true, error: null })
    try {
      const result = await api.users.list()
      if (result.data && result.data.length > 0) {
        set({ users: result.data as CuratedUser[], isLoading: false })
      } else {
        // Fallback to local mock data if backend returns empty
        set({ isLoading: false })
      }
    } catch {
      // Fallback silently to existing mock data
      set({ isLoading: false })
    }
  },

  createUser(user) {
    const id = `user-${crypto.randomUUID().slice(0, 8)}`
    const now = new Date().toISOString()
    set((s) => ({
      users: [{ ...user, id, created_at: now, updated_at: now } as CuratedUser, ...s.users],
    }))
  },

  /**
   * Creates a driver (livreur) with authentication credentials via the backend.
   * Calls POST /api/v1/persons/with-auth to create the person AND provision
   * auth credentials in one atomic operation.
   */
  async createDriver(payload) {
    set({ isLoading: true, error: null })
    try {
      const response = await api.users.create({
        // The with-auth endpoint expects these fields
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        username: payload.username,
        password: payload.password,
        organizationId: payload.organizationId,
        orgId: payload.orgId,
        primarySiteId: payload.primarySiteId,
        title: payload.title,
        jobCode: payload.jobCode || 'DRIVER',
        primaryPhone: payload.primaryPhone,
        roleName: payload.roleName || 'DRIVER',
      } as any)

      // Add the created user to local state
      const now = new Date().toISOString()
      const newUser: CuratedUser = {
        id: (response as any)?.personId || `user-${crypto.randomUUID().slice(0, 8)}`,
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        system_role: 'LIVREUR' as any,
        org_id: payload.organizationId,
        is_active: true,
        created_at: now,
        updated_at: now,
      } as CuratedUser

      set((s) => ({
        users: [newUser, ...s.users],
        isLoading: false,
      }))
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to create driver'
      set({ error: message, isLoading: false })
      throw new Error(message)
    }
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
