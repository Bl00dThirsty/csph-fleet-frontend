import { create } from 'zustand'
import { api, type AuthUser } from '@lpg/api-client'
import { isHydrationFresh } from '@/lib/hydration'
import type { Role, User as CuratedUser } from '@lpg/types'

/**
 * App-side `User` shape. The backend (user-service) speaks camelCase
 * PersonDTO; the HTTP adapter maps it via `mapBackendPersonToUser` to the
 * snake_case shape this store expects. See http-adapter.ts:154.
 */
export type User = CuratedUser

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

/**
 * Payload accepted by `createUser` and `createDriver`. Mirrors the Spring
 * backend's CreatePersonRequest + CreatePersonWithAuthRequest DTOs
 * (csph-fleet-backend/user-service/.../dto). The HTTP adapter accepts both
 * shapes; `username`/`password` trigger the auth-provisioning endpoint
 * (POST /users/with-auth) while omitting them falls back to the plain
 * person endpoint (POST /users/).
 */
interface CreateUserPayload {
  firstName: string
  lastName: string
  email: string
  organizationId: string
  orgId: string
  primarySiteId?: string
  title?: string
  jobCode?: string
  primaryPhone?: string
  roleName?: string
  // Auth provisioning (optional — only required when the new user must log in)
  username?: string
  password?: string
}

interface UsersState {
  users: CuratedUser[]
  isLoading: boolean
  error: string | null
  hasLoaded: boolean
  /** 3.8 — epoch ms of the last successful fetchUsers(); per-page refreshes no-op while fresh. */
  lastFetchedAt: number
  fetchUsers: () => Promise<void>
  createUser: (user: Omit<CuratedUser, 'id' | 'created_at' | 'updated_at'> & { password?: string; username?: string }) => Promise<CuratedUser>
  createDriver: (payload: CreateUserPayload) => Promise<CuratedUser>
  updateUser: (id: string, patch: UserPatch) => Promise<CuratedUser>
  setStatus: (id: string, active: boolean) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  resetPassword: (id: string, newPassword?: string) => Promise<void>
  lockUntil: (id: string, iso?: string | null) => Promise<void>
  unlock: (id: string) => Promise<void>
}

function normalizePatch(p: Partial<CreateUserPayload>): Record<string, unknown> {
  // Maps snake_case app state → camelCase backend DTO
  const out: Record<string, unknown> = {}
  if (p.firstName !== undefined) out.firstName = p.firstName
  if (p.lastName !== undefined) out.lastName = p.lastName
  if (p.email !== undefined) out.email = p.email
  if (p.organizationId !== undefined) out.organizationId = p.organizationId
  if (p.orgId !== undefined) out.orgId = p.orgId
  if (p.primarySiteId !== undefined) out.primarySiteId = p.primarySiteId
  if (p.title !== undefined) out.title = p.title
  if (p.jobCode !== undefined) out.jobCode = p.jobCode
  if (p.primaryPhone !== undefined) out.primaryPhone = p.primaryPhone
  if (p.roleName !== undefined) out.roleName = p.roleName
  if (p.username !== undefined) out.username = p.username
  if (p.password !== undefined) out.password = p.password
  return out
}

function extractError(err: unknown): string {
  const anyErr = err as { response?: { data?: { message?: string; error?: { description?: string } } }; message?: string } | null
  return (
    anyErr?.response?.data?.message ??
    anyErr?.response?.data?.error?.description ??
    anyErr?.message ??
    'Erreur réseau — vérifiez la liaison au service user-service.'
  )
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  isLoading: false,
  error: null,
  hasLoaded: false,
  lastFetchedAt: 0,

  async fetchUsers() {
    // 3.8 — single-flight + freshness: mount hydration and per-page
    // refreshes share one request; fresh data makes this a no-op.
    if (usersInflight) return usersInflight
    if (get().hasLoaded && isHydrationFresh(get().lastFetchedAt)) return
    usersInflight = (async () => {
      set({ isLoading: true, error: null })
      try {
        const result = await api.users.list()
        const list = (result.data ?? []) as CuratedUser[]
        set({ users: list, isLoading: false, hasLoaded: true, lastFetchedAt: Date.now() })
      } catch (err) {
        const message = extractError(err)
        set({ isLoading: false, error: message, hasLoaded: true })
        throw new Error(message)
      } finally {
        usersInflight = null
      }
    })()
    return usersInflight
  },

  /**
   * Creates a non-driver user (ADMIN / SUPERVISOR / AGENT / MARKETEUR /
   * TRANSPORTEUR / INTEGRATEUR) via the backend.
   *
   * If `password` + `username` are provided, POST /users/with-auth is called
   * to provision login credentials in the same atomic operation (used for
   * livreurs). Otherwise the plain POST /users/ endpoint is used.
   */
  async createUser(input) {
    set({ isLoading: true, error: null })
    try {
      const payload = normalizePatch({
        firstName: input.first_name,
        lastName: input.last_name,
        email: input.email,
        organizationId: input.org_id ?? '',
        orgId: input.org_id ?? '',
        primarySiteId: input.site_id,
        title: input.job_title,
        jobCode: (input as any).job_code,
        primaryPhone: input.phone,
        roleName: input.system_role,
        username: input.username,
        password: input.password,
      })

      // POST /users/with-auth when auth creds are provided, else POST /users/
      const response = input.username && input.password
        ? await api.usersCreateWithAuth({ ...payload, username: input.username, password: input.password })
        : await api.users.create(payload as any)

      const saved = response as CuratedUser
      set((s) => ({
        users: [saved, ...s.users.filter((u) => u.id !== saved.id)],
        isLoading: false,
      }))
      return saved
    } catch (err) {
      const message = extractError(err)
      set({ error: message, isLoading: false })
      throw new Error(message)
    }
  },

  /**
   * Creates a driver (livreur) with authentication credentials via the
   * backend. Calls POST /users/with-auth to create the person AND provision
   * auth credentials in one atomic operation.
   */
  async createDriver(payload) {
    set({ isLoading: true, error: null })
    try {
      const response = await api.users.create({
        ...normalizePatch(payload),
        jobCode: payload.jobCode || 'DRIVER',
        roleName: payload.roleName || 'DRIVER',
      } as any)

      const saved = response as CuratedUser
      set((s) => ({
        users: [saved, ...s.users.filter((u) => u.id !== saved.id)],
        isLoading: false,
      }))
      return saved
    } catch (err) {
      const message = extractError(err)
      set({ error: message, isLoading: false })
      throw new Error(message)
    }
  },

  async updateUser(id, patch) {
    set({ isLoading: true, error: null })
    try {
      const body: Record<string, unknown> = {}
      if (patch.first_name !== undefined) body.firstName = patch.first_name
      if (patch.last_name !== undefined) body.lastName = patch.last_name
      if (patch.email !== undefined) body.email = patch.email
      if (patch.phone !== undefined) body.primaryPhone = patch.phone
      if (patch.job_title !== undefined) body.title = patch.job_title
      if (patch.org_id !== undefined) { body.organizationId = patch.org_id; body.orgId = patch.org_id }
      if (patch.site_id !== undefined) body.primarySiteId = patch.site_id
      if (patch.system_role !== undefined) body.roleName = patch.system_role
      if (patch.is_active !== undefined) body.active = patch.is_active
      const updated = await api.users.patch(id, body)
      const saved = updated as CuratedUser
      set((s) => ({
        users: s.users.map((u) => (u.id === id ? saved : u)),
        isLoading: false,
      }))
      return saved
    } catch (err) {
      const message = extractError(err)
      set({ error: message, isLoading: false })
      throw new Error(message)
    }
  },

  async setStatus(id, active) {
    try {
      await api.users.patch(id, { active })
    } catch (err) {
      const message = extractError(err)
      set({ error: message })
      throw new Error(message)
    }
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, is_active: active } : u)),
    }))
  },

  async deleteUser(id) {
    try {
      await api.users.remove(id)
    } catch (err) {
      const message = extractError(err)
      set({ error: message })
      throw new Error(message)
    }
    set((s) => ({
      users: s.users.filter((u) => u.id !== id),
    }))
  },

  async resetPassword(id, newPassword) {
    try {
      await api.usersResetPassword(id, newPassword)
    } catch (err) {
      const message = extractError(err)
      set({ error: message })
      throw new Error(message)
    }
  },

  async lockUntil(id, iso) {
    const stamp = iso ?? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    try {
      await api.users.patch(id, { locked_until: stamp })
    } catch (err) {
      const message = extractError(err)
      set({ error: message })
      throw new Error(message)
    }
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, locked_until: stamp } : u)),
    }))
  },

  async unlock(id) {
    try {
      await api.users.patch(id, { locked_until: null })
    } catch (err) {
      const message = extractError(err)
      set({ error: message })
      throw new Error(message)
    }
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, locked_until: null } : u)),
    }))
  },
}))

// 3.8 — module-level single-flight for fetchUsers (shared by mount
// hydration and per-page refreshes).
let usersInflight: Promise<void> | null = null

export function listOrgsForRole(role: Role): string[] {
  const seen = new Set<string>()
  for (const u of useUsersStore.getState().users) {
    if (u.system_role === role && u.org_id) seen.add(u.org_id)
  }
  return [...seen]
}

// Type re-export so existing importers keep working
export type { AuthUser }