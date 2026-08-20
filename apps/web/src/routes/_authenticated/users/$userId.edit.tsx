import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { UserFormPage } from '@/features/users/components/user-form-page'
import { useUsersStore } from '@/store/users-store'
import { userToView } from '@/features/users/data/users'

export const Route = createFileRoute('/_authenticated/users/$userId/edit')({
  component: UserEditRouteComponent,
})

function UserEditRouteComponent() {
  const { userId } = Route.useParams()
  const users = useUsersStore((s) => s.users)
  const user = useMemo(() => {
    const raw = users.find((u) => u.id === userId)
    return raw ? userToView(raw) : null
  }, [users, userId])

  return <UserFormPage initialUser={user} mode='edit' />
}
