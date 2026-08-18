import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useRoleStore } from '@/store/role-store'
import { Button, Card, CardContent, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@lpg/ui'
import { fakeProfiles, type FakeProfile } from '@lpg/mock-data'
import { UserPicker } from '@/components/login/user-picker'
import { PasswordInput } from '@/components/password-input'
import csphLogo from '@/assets/logo-csph-small.png'
import { toast } from 'sonner'
import type { Role } from '@/config/rbac/roles'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const setActiveRole = useRoleStore((s) => s.setActiveRole)
  const navigate = useNavigate()

  // Mode state: 'direct' (API backend credentials) vs 'demo' (Mock UserPicker)
  const [authMode, setAuthMode] = useState<'direct' | 'demo'>('direct')

  // Direct login state
  const [usernameOrEmail, setUsernameOrEmail] = useState('admin.cspHq')
  const [directPassword, setDirectPassword] = useState('Password123!')

  // Demo picker state
  const [selectedUserId, setSelectedUserId] = useState<string>(fakeProfiles[0]!.id)
  const [demoPassword, setDemoPassword] = useState('password')

  const [submitting, setSubmitting] = useState(false)

  const selectedUser: FakeProfile =
    fakeProfiles.find((u) => u.id === selectedUserId) ?? fakeProfiles[0]!

  useEffect(() => {
    if (authMode === 'demo') {
      setActiveRole(selectedUser.system_role as Role)
    }
  }, [authMode, selectedUser.system_role, setActiveRole])

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(usernameOrEmail, directPassword)
      toast.success('Connexion réussie au backend API !')
      navigate({ to: '/' })
    } catch (err: any) {
      toast.error(err?.message || 'Échec de la connexion. Vérifiez vos identifiants.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(selectedUser.email, demoPassword)
      toast.success(`Connecté sous le profil ${selectedUser.first_name} ${selectedUser.last_name}`)
      navigate({ to: '/' })
    } catch (err: any) {
      toast.error(err?.message || 'Échec de la connexion démo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='grid min-h-screen lg:grid-cols-5'>
      <div className='hidden lg:flex lg:col-span-2 bg-muted relative overflow-hidden'>
        <div className='absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]' />
        <div className='relative z-10 flex flex-col justify-between p-10 w-full'>
          <div className='flex items-center gap-2'>
            <img src={csphLogo} alt='CSPH' className='h-10 w-auto' />
          </div>
          <div className='space-y-3'>
            <h2 className='text-3xl font-bold tracking-tight text-foreground'>CSPH</h2>
            <p className='text-muted-foreground max-w-xs leading-relaxed'>
              Console de gestion de flotte LPG. Authentification centralisée API &amp; Microservices.
            </p>
          </div>
          <p className='text-sm text-muted-foreground'>
            &copy; {new Date().getFullYear()} CSPH. Tous droits réservés.
          </p>
        </div>
      </div>

      <div className='flex items-center justify-center p-8 lg:col-span-3 bg-background'>
        <Card className='w-full max-w-md border shadow-sm'>
          <CardContent className='pt-8 pb-8'>
            <div className='flex justify-center mb-6 lg:hidden'>
              <img src={csphLogo} alt='CSPH' className='h-12 w-auto' />
            </div>

            <div className='space-y-1 mb-6'>
              <h1 className='text-2xl font-bold tracking-tight'>Connexion</h1>
              <p className='text-sm text-muted-foreground'>
                Accédez à la plateforme de gestion de livraison GPL
              </p>
            </div>

            <Tabs value={authMode} onValueChange={(val) => setAuthMode(val as 'direct' | 'demo')} className='w-full'>
              <TabsList className='grid w-full grid-cols-2 mb-6'>
                <TabsTrigger value='direct'>API Backend</TabsTrigger>
                <TabsTrigger value='demo'>Compte Démo</TabsTrigger>
              </TabsList>

              <TabsContent value='direct'>
                <form onSubmit={handleDirectLogin} className='space-y-5'>
                  <div className='space-y-2'>
                    <Label htmlFor='usernameOrEmail'>Identifiant (Email / Nom d'utilisateur)</Label>
                    <Input
                      id='usernameOrEmail'
                      placeholder='admin ou email@csph.cm'
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='directPassword'>Mot de passe</Label>
                    <PasswordInput
                      id='directPassword'
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      required
                    />
                    <p className='text-xs text-muted-foreground'>
                      Connexion au microservice <code className='bg-muted px-1 rounded'>auth-service</code> via l'API Gateway.
                    </p>
                  </div>

                  <Button type='submit' className='w-full' disabled={submitting}>
                    {submitting ? 'Connexion en cours…' : 'Se connecter (API)'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value='demo'>
                <form onSubmit={handleDemoLogin} className='space-y-5'>
                  <div className='space-y-2'>
                    <Label htmlFor='user'>Sélectionner un profil démo</Label>
                    <UserPicker
                      users={fakeProfiles}
                      value={selectedUserId}
                      onChange={setSelectedUserId}
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='demoPassword'>Mot de passe</Label>
                    <PasswordInput
                      id='demoPassword'
                      value={demoPassword}
                      onChange={(e) => setDemoPassword(e.target.value)}
                      required
                    />
                    <p className='text-xs text-muted-foreground'>
                      Simule immédiatement le rôle et les autorisations du persona choisi.
                    </p>
                  </div>

                  <Button type='submit' className='w-full' disabled={submitting}>
                    {submitting ? 'Connexion…' : 'Se connecter (Démo)'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}