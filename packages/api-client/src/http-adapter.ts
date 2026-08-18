import axios, { type AxiosInstance } from 'axios'
import type { ApiEnvelope } from '@lpg/types'
import type { ApiAdapter, ApiPagination, AuthResult, Credentials, ListResult, RequestOptions } from './adapter.ts'
import { fakeAdapter } from './fake-adapter.ts'

type AccessTokenGetter = () => string | null
type UnauthorizedHandler = () => void

function resolveBaseURL(override?: string): string {
  if (override) return override
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL
  if (envUrl) return envUrl
  return 'http://localhost:8080/api/v1'
}

function mapLoginResponseToAuthResult(raw: any): AuthResult {
  if (!raw) {
    throw new Error('Données d\'authentification invalides de la part du serveur')
  }
  if (raw.access_token && raw.user) {
    return raw as AuthResult
  }

  const rawRole = raw.roles && raw.roles.length > 0 ? String(raw.roles[0]).replace(/^ROLE_/, '') : 'SUPERADMIN'
  const displayName = raw.displayName || raw.username || 'Utilisateur'
  const parts = displayName.trim().split(' ')
  const firstName = parts[0] || 'Utilisateur'
  const lastName = parts.slice(1).join(' ') || ''
  const email = raw.username && raw.username.includes('@') ? raw.username : `${raw.username || 'user'}@csph.cm`

  return {
    access_token: raw.accessToken || raw.access_token,
    refresh_token: raw.refreshToken || raw.refresh_token,
    user: {
      id: raw.personId || raw.username || 'user-id',
      email: email,
      first_name: firstName,
      last_name: lastName,
      system_role: rawRole.toUpperCase() as any,
      org_id: raw.orgId || raw.organizationId,
      org_name: raw.orgName,
    },
  }
}

export function createHttpAdapter(baseURL?: string): ApiAdapter {
  const client: AxiosInstance = axios.create({
    baseURL: resolveBaseURL(baseURL ?? (import.meta as any).env?.VITE_API_BASE_URL),
    timeout: 20_000,
  })

  let getAccessToken: AccessTokenGetter = () => null
  let onUnauthorized: UnauthorizedHandler = () => {}
  let isRefreshing = false

  client.interceptors.request.use((config) => {
    const token = getAccessToken()
    if (token) {
      config.headers = config.headers ?? {}
      ;(config.headers as Record<string, string>).Authorization = `Bearer ${token}`
    }
    return config
  })

  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config
      if (error.response?.status === 401 && !original._retry) {
        original._retry = true
        if (!isRefreshing) {
          isRefreshing = true
          try {
            await onUnauthorized()
          } finally {
            isRefreshing = false
          }
        }
        const token = getAccessToken()
        if (token) {
          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${token}`
          return client(original)
        }
      }
      return Promise.reject(error)
    }
  )

  async function request<T>(path: string, init?: RequestOptions): Promise<T> {
    const res = await client.request<ApiEnvelope<T>>({
      url: path,
      method: (init?.method as any) ?? 'GET',
      data: init?.body,
      headers: init?.headers,
    })
    if (!res.data.success) throw new Error(res.data.message || 'Request failed')
    return res.data.data as T
  }

  async function requestList<T>(path: string, init?: RequestOptions): Promise<ListResult<T>> {
    const res = await client.request<ApiEnvelope<T[]>>({
      url: path,
      method: (init?.method as any) ?? 'GET',
      data: init?.body,
      headers: init?.headers,
    })
    if (!res.data.success) throw new Error(res.data.message || 'Request failed')
    return {
      data: (res.data.data as T[]) ?? [],
      pagination: res.data.pagination ?? ({ page: 1, limit: 0, total: 0, pages: 0 } as ApiPagination),
    }
  }

  return {
    request,
    requestList,
    async login(creds: Credentials): Promise<AuthResult> {
      const payload = {
        username: creds.email || (creds as any).username,
        password: creds.password,
      }
      const res = await client.post<ApiEnvelope<any>>('/auth/login', payload)
      if (!res.data.success) throw new Error(res.data.message || 'Échec de la connexion')
      return mapLoginResponseToAuthResult(res.data.data)
    },
    async refresh(refresh_token: string): Promise<AuthResult> {
      const res = await client.post<ApiEnvelope<any>>('/auth/refresh', { refreshToken: refresh_token })
      if (!res.data.success) throw new Error(res.data.message || 'Échec du rafraîchissement de la session')
      const data = res.data.data
      return {
        access_token: data.accessToken || data.access_token,
        refresh_token: data.refreshToken || data.refresh_token || refresh_token,
        user: data.user,
      }
    },
    setAccessTokenGetter(getter) { getAccessToken = getter },
    setOnUnauthorized(handler) { onUnauthorized = handler },
  }
}

export function createApiAdapter(): ApiAdapter {
  const mode = (import.meta as any).env?.VITE_API_MODE
  if (mode === 'fake') return fakeAdapter
  return createHttpAdapter()
}