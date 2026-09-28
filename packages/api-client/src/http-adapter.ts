import axios, { type AxiosInstance } from 'axios'
import type { ApiEnvelope } from '@lpg/types'
import type { ApiAdapter, ApiPagination, AuthResult, Credentials, ListResult, RequestOptions } from './adapter.ts'

type AccessTokenGetter = () => string | null
type UnauthorizedHandler = () => void

function resolveBaseURL(override?: string): string {
  let url = override || (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:18080/api/v1'
  url = url.trim().replace(/\/+$/, '')
  if (url.includes('/v1/api')) {
    url = url.replace(/\/v1\/api/, '/api/v1')
  }
  return url
}

/* ══════════════════════════════════════════════════════════════════════════
   Endpoint contract — frontend resource path → Spring Boot path.
   ─────────────────────────────────────────────────────────────────────────
   `createResourceService` builds paths from the DOMAIN name, which is not
   always the path the services expose. Every divergence is declared here, once,
   instead of being papered over per feature.

   This table is applied by the HTTP adapter ONLY. The fake adapter keeps
   resolving the canonical domain paths, so mock mode is unaffected.
   ══════════════════════════════════════════════════════════════════════════ */

/** Collections whose list path differs from the domain name. */
const LIST_PATH_ALIASES: Record<string, { path: string; params?: Record<string, string> }> = {
  // user-service maps PersonController on {@code @GetMapping("/")}: without
  // the trailing slash Spring MVC answers 404, it does not redirect.
  '/users': { path: '/users/' },
  '/permissions': { path: '/permissions/' },
  '/roles': { path: '/roles/' },
  '/groups': { path: '/groups/' },
  // organization-service has no /clients controller: a client IS an
  // organization whose type is CLIENT.
  '/clients': { path: '/organizations', params: { type: 'CLIENT' } },
  // user-service has no /drivers controller: a driver IS a person.
  '/drivers': { path: '/users/' },
  // user-service has no /custom-roles controller: a custom role is a
  // non-system row of /roles/.
  '/custom-roles': { path: '/roles/' },
  // audit-service exposes /audit/modifications, not /audit-logs.
  '/audit-logs': { path: '/audit/modifications' },
}

/**
 * Sub-path rewrites. Only entries whose CHILD paths differ from the parent are
 * listed — a bare `/roles` is handled by LIST_PATH_ALIASES above, and
 * `/roles/{id}` needs no rewrite, so `/roles` is deliberately absent here.
 */
const PREFIX_PATH_ALIASES: Record<string, string> = {
  '/rfid-tags': '/rfid',
  // NOTE: '/scan-events' must stay on tour-service (POST /scan-events, POST
  // /scan-events/bulk for the PDA). A previous '/scan-events' -> '/scans'
  // alias rewrote bulk uploads to cylinder-service /scans/bulk (404).
  // Cylinder reads live under '/scans' — call api.scans explicitly.
  '/transporter-contracts': '/contracts',
  '/pickup-requests': '/pickups',
  '/delivery-tours': '/tours',
  '/clients': '/organizations',
  '/drivers': '/users',
  '/custom-roles': '/roles',
  '/audit-logs': '/audit',
}

/**
 * Collections the Spring backend does not expose at all. The gateway has a
 * route predicate for some of them, so the request reaches a service and comes
 * back as a 500 from `NoResourceFoundException` — noise the UI cannot act on.
 * They resolve to an empty page and one console warning instead.
 *
 * Keep in sync with the "Not exposed by the backend yet" table in README.md.
 */
const UNIMPLEMENTED_LIST_PATHS = new Set([
  '/regions',
  '/system-roles',
  '/settings',
  '/reports',
  '/notifications',
  '/anomalies',
  '/anomaly-assignments',
  '/notification-groups',
  '/notification-group-members',
  '/notification-rules',
  '/user-site-assignments',
  '/user-custom-roles',
  '/risk-scores',
  '/system/health',
  '/system/metrics',
])

const warnedUnimplemented = new Set<string>()

/** Paths whose payloads are `persons` rows and need {@link mapBackendPersonToUser}. */
const PERSON_PATHS = new Set(['/users', '/users/', '/persons', '/persons/', '/drivers'])

interface RewrittenPath {
  path: string
  unimplemented?: boolean
}
function rewritePath(rawPath: string): RewrittenPath {
  const [rawPathname = '', search = ''] = rawPath.split('?')
  const pathname = rawPathname
  const query = new URLSearchParams(search)

  if (UNIMPLEMENTED_LIST_PATHS.has(pathname)) {
    if (!warnedUnimplemented.has(pathname)) {
      warnedUnimplemented.add(pathname)
      console.warn(
        `[api-client] "${pathname}" is not exposed by the Spring backend yet — ` +
          `returning an empty page instead of a 500. See README.md > "Not exposed by the backend yet".`
      )
    }
    return { path: pathname, unimplemented: true }
  }

  let target: string | undefined

  const listAlias = LIST_PATH_ALIASES[pathname]
  if (listAlias) {
    target = listAlias.path
    if (listAlias.params) {
      for (const [k, v] of Object.entries(listAlias.params)) query.set(k, v)
    }
  } else {
    for (const [from, to] of Object.entries(PREFIX_PATH_ALIASES)) {
      if (pathname.startsWith(`${from}/`)) {
        target = `${to}${pathname.slice(from.length)}`
        break
      }
    }
  }

  const resolved = target ?? pathname
  const qs = query.toString()
  return { path: qs ? `${resolved}?${qs}` : resolved }
}

/**
 * Person DTO (user-service) -> `AppUser` (web app shape).
 *
 * <p>user-service serves people, not "users": `PersonController` is mapped on
 * `/api/v1/persons` AND `/api/v1/users`, and answers camelCase. The business
 * key `personId` IS the login username — `AuthDataInitializer` seeds
 * `persons.person_id = username`, and the PDA/mobile app authenticates with it
 * rather than with the email. Keeping it on the row is what lets an operator
 * read a livreur's PDA login off the /users screen.
 *
 * <p>`system_role` has no column on `persons`: the effective role comes from
 * `user_role_assignments.role_code`, which only the detail projection
 * (`GET /users/{id}`) returns. The list projection carries no roles at all, so
 * rows are handed back with `role_codes: []` and the caller falls back.
 */
export function mapBackendPersonToUser(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw

  const roleCodes: string[] = Array.isArray(raw.roles)
    ? raw.roles
        .map((r: any) => (typeof r === 'string' ? r : r?.roleCode))
        .filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
    : []

  // "CSPH Admin" -> { first: "CSPH", last: "Admin" } only when first/last are
  // absent: the detail endpoint returns both, the list endpoint does not.
  const display = String(raw.displayName ?? '').trim()
  let firstName: string | null = raw.firstName ?? null
  let lastName: string | null = raw.lastName ?? null
  if ((!firstName || !lastName) && display) {
    const parts = display.split(/\s+/)
    firstName = firstName ?? parts[0] ?? display
    lastName = lastName ?? (parts.slice(1).join(' ') || firstName)
  }

  return {
    id: raw.id,
    username: raw.personId ?? null,
    // No synthesized address: the old fallback minted `personId@cspHq.cm`,
    // a deliverable-looking email nobody owns. Blank until the server says.
    email: raw.email ?? '',
    first_name: firstName ?? raw.personId ?? '—',
    last_name: lastName ?? '',
    system_role: roleCodes[0] ?? 'LIVREUR',
    role_codes: roleCodes,
    org_id: raw.orgId ?? raw.organizationId ?? null,
    site_id: raw.siteId ?? raw.primarySiteId ?? null,
    phone: raw.primaryPhone ?? undefined,
    job_title: raw.title ?? raw.jobCodeDescription ?? undefined,
    job_code: raw.jobCode ?? undefined,
    city: raw.city ?? undefined,
    language: raw.language ?? undefined,
    is_active: raw.active ?? raw.status === 'ACTIVE',
    is_certified: raw.certified ?? undefined,
    is_locked: raw.locked ?? undefined,
    last_login_at: raw.lastLoginAt ?? null,
    created_at: raw.createdAt ?? null,
    updated_at: raw.changedate ?? raw.updatedAt ?? null,
    deleted_at: raw.deletedAt ?? null,
  }
}

const EMPTY_PAGE: ApiPagination = { page: 1, limit: 50, total: 0, pages: 1 }

/**
 * Gateway errors are NOT ApiResponse envelopes: GatewayErrorWebExceptionHandler
 * emits `{status, error, targetService, hint, message}` (and HTML to browsers).
 * Axios rejects non-2xx before the envelope checks below ever run, so without
 * this the UI surfaces "Request failed with status code 503" instead of the
 * gateway's own message + routing hint. Normalize every transport failure
 * into a readable Error carrying status, target service, and hint.
 */
export function toApiError(error: unknown, path: string): Error {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response
  if (!response) {
    const message = error instanceof Error ? error.message : String(error)
    return new Error(`Serveur injoignable (${path}) : ${message}`)
  }
  const status = response.status ?? 0
  const data = response.data
  if (typeof data === 'string' && data.includes('<html')) {
    return new Error(`Erreur passerelle ${status || ''} sur ${path} : réponse HTML au lieu de JSON.`.trim())
  }
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    // Gateway shape: {status, error, targetService, hint, message}.
    // Spring ApiResponse shape: {success: false, message}.
    const message =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.error === 'string' && body.error) ||
      `Requête échouée (${status})`
    const target = typeof body.targetService === 'string' ? ` [${body.targetService}]` : ''
    const hint = typeof body.hint === 'string' && body.hint ? ` — ${body.hint}` : ''
    const err = new Error(`${message}${target}${hint}`)
    ;(err as Error & { status?: number }).status = status
    return err
  }
  return new Error(`Requête échouée sur ${path} (${status || 'sans réponse'})`)
}

function deriveSystemRole(raw: any): string {
  const roleCandidate = raw.roles && raw.roles.length > 0 ? String(raw.roles[0]).toUpperCase().replace(/^ROLE_/, '') : ''
  
  if (roleCandidate === 'MARKETEUR' || roleCandidate === 'MARKETER' || roleCandidate === 'GEST_STK' || roleCandidate === 'MKT') {
    return 'MARKETEUR'
  }
  if (roleCandidate === 'TRANSPORTEUR' || roleCandidate === 'TRANSPORTER' || roleCandidate === 'TRP') {
    return 'TRANSPORTEUR'
  }
  if (roleCandidate === 'ADMIN') return 'ADMIN'
  if (roleCandidate === 'SUPERADMIN') return 'SUPERADMIN'
  if (roleCandidate === 'SUPERVISOR' || roleCandidate === 'SUPERVISEUR') return 'SUPERVISOR'
  if (roleCandidate === 'AGENT') return 'AGENT'
  if (roleCandidate === 'INTEGRATEUR' || roleCandidate === 'INTEGRATOR') return 'INTEGRATEUR'
  if (roleCandidate === 'LIVREUR') return 'LIVREUR'
  // DRIVER is its own backend role (PDA mobile), not an alias of LIVREUR.
  // The old collapse mapped every driver to LIVREUR, permanently emptying the
  // driver dropdown that filters on system_role === 'DRIVER'.
  if (roleCandidate === 'DRIVER') return 'DRIVER'

  // Fallback by username or org prefix
  const username = String(raw.username || '').toLowerCase()
  const orgId = String(raw.orgId || raw.organizationId || '').toUpperCase()

  if (username.startsWith('gest.') || username.includes('mkt') || orgId.startsWith('MKT') || orgId.includes('SCTM') || orgId.includes('CAMGAZ') || orgId.includes('GPL')) {
    return 'MARKETEUR'
  }
  if (username.startsWith('resp.') || username.includes('trans') || orgId.startsWith('TRP') || orgId.includes('TRANS')) {
    return 'TRANSPORTEUR'
  }
  if (username.startsWith('superadmin')) return 'SUPERADMIN'
  if (username.startsWith('superviseur') || username.startsWith('supervisor')) return 'SUPERVISOR'
  if (username.startsWith('agent')) return 'AGENT'
  if (username.startsWith('integrateur') || username.startsWith('tech')) return 'INTEGRATEUR'
  if (username.startsWith('admin')) return 'ADMIN'

  return 'MARKETEUR'
}

function mapLoginResponseToAuthResult(raw: any): AuthResult {
  if (!raw) {
    throw new Error('Données d\'authentification invalides de la part du serveur')
  }
  if (raw.access_token && raw.user) {
    return raw as AuthResult
  }

  const systemRole = deriveSystemRole(raw)
  const displayName = raw.displayName || raw.username || 'Utilisateur'
  const parts = displayName.trim().split(' ')
  const firstName = parts[0] || 'Utilisateur'
  const lastName = parts.slice(1).join(' ') || ''
  const email = raw.username && raw.username.includes('@') ? raw.username : `${raw.username || 'user'}@gpl.cm`

  // No invented org identity: when the server omits the org, the fields stay
  // undefined. The old code fell back to a hardcoded SCTM id and names
  // ("Express GPL Transport", "CSPH Siège"), attributing every org-less login
  // to a real company.
  const orgId = raw.orgId || raw.organizationId || undefined
  const orgName = raw.orgName || undefined

  return {
    access_token: raw.accessToken || raw.access_token,
    refresh_token: raw.refreshToken || raw.refresh_token,
    user: {
      id: raw.personId || raw.username || 'user-id',
      email: email,
      first_name: firstName,
      last_name: lastName,
      system_role: systemRole as any,
      org_id: orgId,
      org_name: orgName,
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
    livreur_user_id: raw.driverPersonId || raw.livreurPersonId || raw.livreur_user_id,
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
  if (body.livreur_user_id !== undefined) mapped.driverPersonId = body.livreur_user_id
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

    const rewritten = rewritePath(path)
    if (rewritten.unimplemented) return undefined as T

    let res
    try {
      res = await client.request<any>({
        url: rewritten.path,
        method: (init?.method as any) ?? 'GET',
        data: body,
        headers: init?.headers,
      })
    } catch (error) {
      throw toApiError(error, rewritten.path)
    }
    const data = res.data?.data !== undefined ? res.data.data : res.data
    if (res.data && res.data.success === false) throw new Error(res.data.message || 'Request failed')

    if (data && typeof data === 'object') {
      if (PERSON_PATHS.has(rewritten.path)) {
        return mapBackendPersonToUser(data) as T
      }
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
    const rewritten = rewritePath(path)
    if (rewritten.unimplemented) return { data: [] as T[], pagination: { ...EMPTY_PAGE } }

    let res
    try {
      res = await client.request<any>({
        url: rewritten.path,
        method: (init?.method as any) ?? 'GET',
        data: init?.body,
        headers: init?.headers,
      })
    } catch (error) {
      throw toApiError(error, rewritten.path)
    }
    if (res.data && res.data.success === false) throw new Error(res.data.message || 'Request failed')

    const envelopeData = res.data?.data !== undefined ? res.data.data : res.data
    let rawItems: any[] = []
    let pagination: ApiPagination = { page: 1, limit: 50, total: 0, pages: 1 }

    if (Array.isArray(envelopeData)) {
      rawItems = envelopeData
      pagination.total = rawItems.length
      pagination.limit = rawItems.length
      pagination.pages = 1
    } else if (envelopeData && typeof envelopeData === 'object') {
      // Two list shapes reach this adapter:
      //  - common-lib `PageResponse` serialises `member` first, with `content`
      //    and `totalElements` as getter aliases, and pages with
      //    `pageNumber` / `pageSize` / `totalPages`;
      //  - Spring Data's own `Page` uses `content` with `number` / `size` /
      //    `totalElements`. Accept both rather than guessing per service.
      const items = Array.isArray(envelopeData.member)
        ? envelopeData.member
        : Array.isArray(envelopeData.content)
          ? envelopeData.content
          : []
      rawItems = items
      const total = envelopeData.totalCount ?? envelopeData.totalElements ?? items.length
      const limit = envelopeData.pageSize ?? envelopeData.size ?? items.length
      const pageNumber = envelopeData.pageNumber ?? envelopeData.number ?? 0
      pagination = {
        page: pageNumber + 1,
        limit: limit || items.length || 50,
        total,
        pages: envelopeData.totalPages ?? Math.max(1, Math.ceil(total / (limit || items.length || 1))),
      }
    }

    const isPersonList = PERSON_PATHS.has(rewritten.path)
    const mappedItems = rawItems.map((item) => {
      if (item && typeof item === 'object') {
        if (isPersonList) {
          return mapBackendPersonToUser(item)
        }
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
        // auth-service persists both on `auth_users.last_login_ip` and on the
        // `refresh_tokens` row. They are not @NotBlank, so omitting them makes
        // the FIRST login pass while the SECOND one overflows the column.
        deviceInfo: 'CSPH-Fleet-Web',
        ipAddress: '127.0.0.1',
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

/**
 * The single adapter factory. There is no fake mode: the fake-adapter served
 * invented API responses and its `VITE_API_MODE=fake` switch is deleted with
 * it. Every call below hits the Spring backend (or fails loudly trying).
 */
export function createApiAdapter(): ApiAdapter {
  return createHttpAdapter()
}