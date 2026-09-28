import { useCallback, useEffect, useMemo, useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { UserPlus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UsersTable } from './components/users-table'
import { UserDetailsSheet } from './components/user-details-sheet'
import { useUsersStore } from '@/store/users-store'
import { userToView, type UserView } from './data/users'
import { hasPermission } from '@lpg/permissions'
import { useRoleStore } from '@/store/role-store'
import { useAuthStore } from '@/store/auth-store'

const route = getRouteApi('/_authenticated/users/')

export function UsersPage() {
  const search = route.useSearch()
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const activeRole = useRoleStore((s) => s.activeRole)
  const effectiveRole = activeRole || (authUser?.system_role as any) || 'SUPERADMIN'

  const [detailsUser, setDetailsUser] = useState<UserView | null>(null)

  const isMarketer = effectiveRole === 'MARKETEUR'
  const isTransporter = effectiveRole === 'TRANSPORTEUR'
  const userOrgId = authUser?.org_id || 'org-0002-sctm-0000-000000000001'

  const allUsers = useUsersStore((s) => s.users)
  const isLoading = useUsersStore((s) => s.isLoading)

  // The store ships seeded with `curated.users`, so without this the page would
  // never show a single real row from user-service. fetchUsers() replaces the
  // seed and falls back to it if the API is unreachable.
  useEffect(() => {
    void useUsersStore.getState().fetchUsers()
  }, [])

  const scopedUsers = useMemo(() => {
    if (isMarketer || isTransporter) {
      const filtered = allUsers.filter(
        (u) => u.org_id === userOrgId || u.email.includes('sctm') || u.email.includes('gpl')
      )
      return filtered.length > 0 ? filtered : allUsers.slice(0, 4)
    }
    return allUsers
  }, [allUsers, isMarketer, isTransporter, userOrgId])

  const view = useMemo(() => scopedUsers.map(userToView), [scopedUsers])
  const canCreate = hasPermission(effectiveRole, 'users.create')

  const handleViewDetails = useCallback((user: UserView) => {
    setDetailsUser(user)
  }, [])

  const handleEdit = useCallback(
    (user: UserView) => {
      navigate({
        to: '/users/$userId/edit',
        params: { userId: user.id },
      })
    },
    [navigate],
  )

  const handleCreate = () => {
    navigate({ to: '/users/new' })
  }

  const pageTitle = isMarketer
    ? 'Mon Équipe & Collaborateurs'
    : isTransporter
      ? 'Chauffeurs & Équipe Transporteur'
      : 'Utilisateurs & RBAC Plateforme'

  const pageDescription = isMarketer
    ? 'Gestion des gestionnaires, dispatchers, responsables logistiques et livreurs PDA de votre organisation.'
    : isTransporter
      ? 'Gestion des chauffeurs routiers, livreurs convoyeurs et responsables de flotte.'
      : 'Annuaire national consolidé des utilisateurs, attribution de rôles et matrice des permissions.'

  return (
    <main
      id='main-content'
      className='flex-1 space-y-4 bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 sm:p-6 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900'
    >
      <section className='rounded-2xl border-transparent bg-background/88 p-3 shadow-sm backdrop-blur-sm sm:p-4'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <div className='rounded-xl bg-primary/10 p-2.5 text-primary'>
              <Users className='h-6 w-6' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h1 className='text-2xl font-bold tracking-tight'>{pageTitle}</h1>
                <Badge variant='outline' className='ml-2 font-mono'>
                  {isLoading ? 'chargement…' : `${view.length} collaborateur(s)`}
                </Badge>
              </div>
              <p className='text-xs text-muted-foreground sm:text-sm'>
                {pageDescription}
              </p>
            </div>
          </div>

          {canCreate && (
            <Button onClick={handleCreate} className='flex items-center gap-2 shadow-sm'>
              <UserPlus className='h-4 w-4' /> Nouveau collaborateur
            </Button>
          )}
        </div>
      </section>

      <section className='space-y-4 rounded-xl border-transparent bg-background/92 p-4 shadow-sm'>
        <UsersTable
          data={view}
          search={search}
          navigate={navigate as any}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
        />
      </section>

      <UserDetailsSheet
        user={detailsUser}
        open={detailsUser !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsUser(null)
        }}
      />
    </main>
  )
}
