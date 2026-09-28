import type { MfaStatus } from '@lpg/types'
import { useUsersStore } from '@/store/users-store'

export type LivreurStatus = 'ACTIVE' | 'INACTIVE'

export interface LivreurView {
  id: string
  email: string
  fullName: string
  orgId: string
  orgName: string
  status: LivreurStatus
  mfaStatus: MfaStatus
  lastLogin: string
  created_at: string
}

/**
 * Live fetch — pulls every user with role `LIVREUR` from the live users-store
 * (which is hydrated by api.users.list). The previous curated.* seed has been
 * removed.
 */
export function getLivreurs(): LivreurView[] {
  const users = useUsersStore.getState().users
  return users
    .filter((user) => user.system_role === 'LIVREUR' || (user as any).role_codes?.includes('LIVREUR'))
    .map((user) => ({
      id: user.id,
      email: user.email,
      fullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      orgId: user.org_id,
      orgName: (user as any).org_name ?? user.org_id ?? '—',
      status: user.is_active ? 'ACTIVE' : 'INACTIVE',
      mfaStatus: user.mfa_status ?? 'DISABLED',
      lastLogin: user.last_login_at ?? '—',
      created_at: user.created_at ?? '—',
    }))
}

export const LIVREUR_STATUS_LABELS: Record<LivreurStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
}

export function livreurStatusLabel(status: LivreurStatus): string {
  return LIVREUR_STATUS_LABELS[status]
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