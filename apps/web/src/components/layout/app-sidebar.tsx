import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@lpg/ui'
import { AppTitle } from './app-title'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { useRoleStore } from '@/store/role-store'
import { useAuthStore } from '@/store/auth-store'
import { getSidebarData } from '@/config/rbac/sidebar-by-role'
import type { Role } from '@/config/rbac/roles'

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const activeRole = useRoleStore((s) => s.activeRole)
  const authUserRole = useAuthStore((s) => s.user?.system_role as Role | undefined)
  
  const effectiveRole: Role = (activeRole && activeRole !== 'LIVREUR')
    ? activeRole
    : (authUserRole && authUserRole !== 'LIVREUR')
      ? authUserRole
      : 'SUPERADMIN'

  const sidebarData = getSidebarData(effectiveRole)

  return (
    <Sidebar collapsible='icon' variant='inset' {...props}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((group) => (
          <NavGroup key={group.title} title={group.title} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
