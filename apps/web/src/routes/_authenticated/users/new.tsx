import { createFileRoute } from '@tanstack/react-router'
import { UserFormPage } from '@/features/users/components/user-form-page'

export const Route = createFileRoute('/_authenticated/users/new')({
  component: () => <UserFormPage mode='create' />,
})
