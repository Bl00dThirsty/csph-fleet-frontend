import { create } from 'zustand'
import { type Role, ROLES } from '@/config/rbac/roles'

type RoleState = {
  activeRole: Role
  setActiveRole: (role: Role) => void
}

const initialRole: Role = 'LIVREUR'

export const useRoleStore = create<RoleState>()((set) => ({
  activeRole: initialRole,
  setActiveRole: (role) => set({ activeRole: role }),
}))

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
