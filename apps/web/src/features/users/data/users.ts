import { curated } from '@lpg/mock-data'
import type {
  User as CuratedUser,
  MfaStatus,
  Organization,
} from '@lpg/types'
import type { Role } from '@lpg/permissions'
import { ROLE_LABELS } from '@/config/rbac/roles'
import { useUsersStore } from '@/store/users-store'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface UserView {
  id: string
  /**
   * Login identifier (`persons.person_id`): `superadmin.cspHq`,
   * `chauffeur.abc1`… This is what the livreur types on the PDA/mobile app,
   * so it must be visible next to the e-mail.
   */
  username: string
  email: string
  first_name: string
  last_name: string
  fullName: string
  phone?: string
  job_title?: string
  job_code?: string
  city?: string
  language?: string
  site_id?: string
  custom_permissions?: string[]
  role_codes: string[]
  role: Role
  roleLabel: string
  orgId: string
  orgName: string
  status: UserStatus
  mfaStatus: MfaStatus
  lastLogin: string
  created_at: string
  updated_at: string
}

const ORG_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  (curated.organizations as Organization[]).map((org) => [org.id, org.name]),
)

export function userToView(user: CuratedUser): UserView {
  const roleCodes = user.role_codes ?? []
  // The list projection of /api/v1/users/ carries no roles at all, so a row
  // loaded from the list has nothing to derive `system_role` from. Falling back
  // to MARKETEUR keeps the RBAC surface (and the sidebar) stable instead of
  // throwing on an unknown role.
  const role = (user.system_role ?? roleCodes[0] ?? 'MARKETEUR') as Role
  return {
    id: user.id,
    username: user.username ?? user.email,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    fullName: `${user.first_name} ${user.last_name}`.trim() || user.username || user.email,
    phone: user.phone,
    job_title: user.job_title,
    job_code: user.job_code,
    city: user.city,
    language: user.language,
    site_id: user.site_id,
    custom_permissions: user.custom_permissions,
    role_codes: roleCodes,
    role,
    roleLabel: ROLE_LABELS[role] ?? role,
    orgId: user.org_id,
    orgName: ORG_NAME_BY_ID[user.org_id] ?? '—',
    status: user.is_active ? 'ACTIVE' : 'INACTIVE',
    mfaStatus: user.mfa_status ?? 'DISABLED',
    lastLogin: user.last_login_at ?? '—',
    created_at: user.created_at ?? '—',
    updated_at: user.updated_at ?? '—',
  }
}

export function getUsers(): UserView[] {
  return useUsersStore.getState().users.map(userToView)
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
}

export function userStatusLabel(status: UserStatus): string {
  return USER_STATUS_LABELS[status]
}

export const MFA_STATUS_LABELS: Record<MfaStatus, string> = {
  DISABLED: 'Désactivé',
  PENDINGSETUP: 'En attente de configuration',
  ENABLED: 'Activé',
  LOCKED: 'Verrouillé',
}

export function mfaStatusLabel(status: MfaStatus): string {
  return MFA_STATUS_LABELS[status]
}
