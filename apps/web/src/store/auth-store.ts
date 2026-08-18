import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, apiAdapter } from '@lpg/api-client'
import type { AuthUser, AuthResult } from '@lpg/api-client'
import { useRoleStore } from '@/store/role-store'
import type { Role } from '@/config/rbac/roles'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  status: 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated'
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hydrateSession: () => Promise<void>
  updateProfile: (patch: Partial<Pick<AuthUser, 'first_name' | 'last_name' | 'email'>>) => void
}

// Bridge the adapter to the stored access token so HTTP requests carry the bearer.
apiAdapter.setAccessTokenGetter(() => useAuthStore.getState().accessToken)
apiAdapter.setOnUnauthorized(() => useAuthStore.getState().logout())

async function applyAuthResult(result: AuthResult) {
  useAuthStore.setState({
    user: result.user,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    status: 'authenticated',
  })
  if (result.user?.system_role) {
    useRoleStore.getState().setActiveRole(result.user.system_role as Role)
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: 'idle',

      async login(email, password) {
        set({ status: 'authenticating' })
        try {
          const result = await api.auth.login({ email, password })
          await applyAuthResult(result)
        } catch (err) {
          set({ status: 'unauthenticated' })
          throw err
        }
      },

      logout() {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          status: 'unauthenticated',
        })
      },

      async hydrateSession() {
        const { refreshToken, status } = useAuthStore.getState()
        if (!refreshToken || status === 'authenticated') return
        try {
          const result = await api.auth.refresh(refreshToken)
          await applyAuthResult(result)
        } catch {
          set({ status: 'unauthenticated' })
        }
      },

      updateProfile(patch) {
        const { user } = useAuthStore.getState()
        if (!user) return
        set({ user: { ...user, ...patch } })
      },
    }),
    {
      name: 'lpg-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        status: state.status,
      }),
    },
  ),
)
