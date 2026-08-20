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

export function mapBackendCheckpointToCheckpoint(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  return {
    id: raw.id,
    tour_id: raw.tourId || raw.tour_id || raw.tourneeId || raw.tournee_id,
    tournee_id: raw.tourId || raw.tour_id || raw.tourneeId || raw.tournee_id || '',
    site_id: raw.siteId || raw.site_id,
    client_site_id: raw.clientSiteId || raw.client_site_id,
    sequence: raw.sequence ?? 0,
    expected_arrival: raw.expectedArrival || raw.expected_arrival,
    actual_arrival: raw.actualArrival || raw.actual_arrival,
    status: raw.status || 'PENDING',
    status_description: raw.statusDescription || raw.status_description,
    status_date: raw.statusDate || raw.status_date,
    skip_reason: raw.skipReason || raw.skip_reason,
    created_at: raw.createdAt || raw.created_at,
    updated_at: raw.changedate || raw.updated_at,
    created_by: raw.createdBy || raw.created_by,
    updated_by: raw.changeby || raw.updated_by,
  }
}

export function mapBackendTourToDeliveryTour(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  const checkpoints = Array.isArray(raw.checkpoints)
    ? raw.checkpoints.map(mapBackendCheckpointToCheckpoint)
    : undefined

  return {
    id: raw.id,
    tour_code: raw.tourCode || raw.tour_code,
    marketeur_org_id: raw.marketerOrganizationId || raw.marketeur_org_id,
    execution_mode: raw.executionMode || raw.execution_mode,
    transporter_org_id: raw.transporterOrganizationId || raw.transporter_org_id,
    vehicle_id: raw.vehicleId || raw.vehicle_id,
    driver_id: raw.driverId || raw.driver_id,
    livreur_user_id: raw.livreurPersonId || raw.livreur_user_id,
    assigned_by_transporter_user_id: raw.assignedByTransporterPersonId || raw.assigned_by_transporter_user_id,
    transporter_assigned_at: raw.transporterAssignedAt || raw.transporter_assigned_at,
    sent_to_transporter_at: raw.sentToTransporterAt || raw.sent_to_transporter_at,
    type: raw.type,
    status: raw.status,
    status_description: raw.statusDescription || raw.status_description,
    status_date: raw.statusDate || raw.status_date,
    requested_quantity: raw.requestedQuantity ?? raw.requested_quantity ?? 0,
    loaded_quantity: raw.loadedQuantity ?? raw.loaded_quantity,
    delivered_quantity: raw.deliveredQuantity ?? raw.delivered_quantity,
    started_at: raw.startedAt || raw.started_at,
    closed_at: raw.closedAt || raw.closed_at,
    created_at: raw.createdAt || raw.created_at,
    updated_at: raw.changedate || raw.updated_at,
    created_by: raw.createdBy || raw.created_by,
    updated_by: raw.changeby || raw.updated_by,
    checkpoints,
  }
}

export function mapBackendPickupToPickupRequest(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  return {
    id: raw.id,
    reference: raw.reference || `PU-${String(raw.id || '').slice(0, 6)}`,
    marketeur_org_id: raw.marketerOrganizationId || raw.marketeur_org_id,
    source_site_id: raw.sourceSiteId || raw.source_site_id,
    destination_site_id: raw.destinationSiteId || raw.destination_site_id,
    requested_quantity: raw.requestedQuantity ?? raw.requested_quantity ?? 0,
    approved_quantity: raw.approvedQuantity ?? raw.approved_quantity,
    status: raw.status || 'DRAFT',
    status_description: raw.statusDescription || raw.status_description,
    status_date: raw.statusDate || raw.status_date,
    created_at: raw.createdAt || raw.created_at,
    updated_at: raw.changedate || raw.updated_at,
    created_by: raw.createdBy || raw.created_by,
    updated_by: raw.changeby || raw.updated_by,
  }
}

function mapTourPayloadToBackend(body: any): any {
  if (!body || typeof body !== 'object') return body
  const mapped: any = { ...body }
  if (body.tour_code !== undefined) mapped.tourCode = body.tour_code
  if (body.marketeur_org_id !== undefined) mapped.marketerOrganizationId = body.marketeur_org_id
  if (body.execution_mode !== undefined) mapped.executionMode = body.execution_mode
  if (body.transporter_org_id !== undefined) mapped.transporterOrganizationId = body.transporter_org_id
  if (body.vehicle_id !== undefined) mapped.vehicleId = body.vehicle_id
  if (body.driver_id !== undefined) mapped.driverId = body.driver_id
  if (body.livreur_user_id !== undefined) mapped.livreurPersonId = body.livreur_user_id
  if (body.requested_quantity !== undefined) mapped.requestedQuantity = body.requested_quantity
  if (body.loaded_quantity !== undefined) mapped.loadedQuantity = body.loaded_quantity
  if (body.delivered_quantity !== undefined) mapped.deliveredQuantity = body.delivered_quantity
  return mapped
}

function mapPickupPayloadToBackend(body: any): any {
  if (!body || typeof body !== 'object') return body
  const mapped: any = { ...body }
  if (body.marketeur_org_id !== undefined) mapped.marketerOrganizationId = body.marketeur_org_id
  if (body.source_site_id !== undefined) mapped.sourceSiteId = body.source_site_id
  if (body.destination_site_id !== undefined) mapped.destinationSiteId = body.destination_site_id
  if (body.requested_quantity !== undefined) mapped.requestedQuantity = body.requested_quantity
  if (body.approved_quantity !== undefined) mapped.approvedQuantity = body.approved_quantity
  return mapped
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
    let body = init?.body
    if (body && typeof body === 'string') {
      if (path.startsWith('/tours') || path.startsWith('/delivery-tours')) {
        try {
          const parsed = JSON.parse(body)
          body = JSON.stringify(mapTourPayloadToBackend(parsed))
        } catch {
          // preserve body as is
        }
      } else if (path.startsWith('/pickups') || path.startsWith('/pickup-requests')) {
        try {
          const parsed = JSON.parse(body)
          body = JSON.stringify(mapPickupPayloadToBackend(parsed))
        } catch {
          // preserve body as is
        }
      }
    }

    const res = await client.request<any>({
      url: path,
      method: (init?.method as any) ?? 'GET',
      data: body,
      headers: init?.headers,
    })
    const data = res.data?.data !== undefined ? res.data.data : res.data
    if (res.data && res.data.success === false) throw new Error(res.data.message || 'Request failed')

    if (data && typeof data === 'object') {
      if (data.tourCode || (data.executionMode && data.marketerOrganizationId)) {
        return mapBackendTourToDeliveryTour(data) as T
      }
      if (data.sourceSiteId || data.destinationSiteId) {
        return mapBackendPickupToPickupRequest(data) as T
      }
      if (data.expectedArrival || data.actualArrival) {
        return mapBackendCheckpointToCheckpoint(data) as T
      }
    }
    return data as T
  }

  async function requestList<T>(path: string, init?: RequestOptions): Promise<ListResult<T>> {
    const res = await client.request<any>({
      url: path,
      method: (init?.method as any) ?? 'GET',
      data: init?.body,
      headers: init?.headers,
    })
    if (res.data && res.data.success === false) throw new Error(res.data.message || 'Request failed')

    const envelopeData = res.data?.data !== undefined ? res.data.data : res.data
    let rawItems: any[] = []
    let pagination: ApiPagination = { page: 1, limit: 50, total: 0, pages: 1 }

    if (Array.isArray(envelopeData)) {
      rawItems = envelopeData
      pagination.total = rawItems.length
    } else if (envelopeData && Array.isArray(envelopeData.content)) {
      rawItems = envelopeData.content
      pagination = {
        page: (envelopeData.page ?? 0) + 1,
        limit: envelopeData.size ?? rawItems.length,
        total: envelopeData.totalElements ?? rawItems.length,
        pages: envelopeData.totalPages ?? 1,
      }
    }

    const mappedItems = rawItems.map((item) => {
      if (item && typeof item === 'object') {
        if (item.tourCode || (item.executionMode && item.marketerOrganizationId)) {
          return mapBackendTourToDeliveryTour(item)
        }
        if (item.sourceSiteId || item.destinationSiteId) {
          return mapBackendPickupToPickupRequest(item)
        }
      }
      return item
    })

    return {
      data: mappedItems as T[],
      pagination: res.data?.pagination ?? pagination,
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