import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  FileText,
  Fuel,
  KeyRound,
  Lock,
  Mail,
  Package,
  Phone,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User as UserIcon,
  Users2,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@lpg/ui'
import { useEffect } from 'react'
import { api } from '@lpg/api-client'
import {
  PERMISSION_CATALOG,
  PREDEFINED_PROFILES,
  ROLE_LABELS,
  ROLE_GRANTS,
  type PermissionCode,
  type Role,
} from '@lpg/permissions'
import { getSites } from '@/features/sites/data/sites'
import { sitesHooks, organizationsHooks } from '@/lib/api/use-resources'
import { useAuthStore } from '@/store/auth-store'
import { useRoleStore } from '@/store/role-store'
import { useUsersStore } from '@/store/users-store'
import type { UserView } from '../data/users'

interface UserFormPageProps {
  initialUser?: UserView | null
  mode: 'create' | 'edit'
}

interface FormState {
  first_name: string
  last_name: string
  email: string
  phone: string
  job_title: string
  org_id: string
  site_id: string
  system_role: Role
  selected_profile_id: string
  custom_permissions: string[]
  is_active: boolean
  must_change_password: boolean
  temp_password: string
}

interface OrganizationOption {
  id: string
  name: string
  type: string
}

export function UserFormPage({ initialUser, mode }: UserFormPageProps) {
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const activeRole = useRoleStore((s) => s.activeRole)
  const effectiveRole = activeRole || (authUser?.system_role as Role) || 'SUPERADMIN'

  // Live organizations from the organization-service — replaces the
  // curated.organizations hard-coded fallback.
  const [organizationOptions, setOrganizationOptions] = useState<OrganizationOption[]>([])
  useEffect(() => {
    let cancelled = false
    api.organizations
      .list({ size: 200 })
      .then((res) => {
        if (cancelled) return
        const list = (res.data ?? []) as unknown as OrganizationOption[]
        setOrganizationOptions(list)
      })
      .catch((err: unknown) => {
        // Surface the error in the form below; don't crash the page.
        // eslint-disable-next-line no-console
        console.warn('[UserFormPage] organisations indisponibles', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Is this actor constrained to their own organization?
  const isActorOrganizationLocked =
    effectiveRole === 'MARKETEUR' || effectiveRole === 'TRANSPORTEUR'

  const userOrgId = authUser?.org_id || 'CSPH'

  const [form, setForm] = useState<FormState>(() => {
    if (initialUser) {
      const matchingProfile = PREDEFINED_PROFILES.find(
        (p) => p.baseRole === initialUser.role,
      )
      return {
        first_name: initialUser.first_name || initialUser.fullName.split(' ')[0] || '',
        last_name: initialUser.last_name || initialUser.fullName.split(' ').slice(1).join(' ') || '',
        email: initialUser.email,
        phone: initialUser.phone || '',
        job_title: initialUser.job_title || '',
        org_id: initialUser.orgId || userOrgId,
        site_id: initialUser.site_id || '',
        system_role: initialUser.role,
        selected_profile_id: matchingProfile?.id || 'custom',
        custom_permissions: initialUser.custom_permissions || [],
        is_active: initialUser.status === 'ACTIVE',
        must_change_password: false,
        temp_password: '',
      }
    }

    const defaultRole: Role = isActorOrganizationLocked
      ? (effectiveRole === 'MARKETEUR' ? 'MARKETEUR' : 'TRANSPORTEUR')
      : 'ADMIN'

    const defaultProfile = PREDEFINED_PROFILES.find((p) => p.baseRole === defaultRole)

    return {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_title: '',
      org_id: isActorOrganizationLocked ? userOrgId : '',
      site_id: '',
      system_role: defaultRole,
      selected_profile_id: defaultProfile?.id || 'mkt-lead',
      custom_permissions: [],
      is_active: true,
      must_change_password: true,
      temp_password: 'Password123!',
    }
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Collapsible accordion state for permission categories
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    approvisionnements: false,
    livraisons: false,
    flotte: false,
    declarations: true,
    supervision: true,
    reporting: true,
    administration: true,
  })

  function toggleCategoryCollapse(catKey: string) {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }))
  }

  function expandAll() {
    setCollapsedCategories({})
  }

  function collapseAll() {
    setCollapsedCategories({
      approvisionnements: true,
      livraisons: true,
      flotte: true,
      declarations: true,
      supervision: true,
      reporting: true,
      administration: true,
    })
  }

  // Filter available predefined profiles according to target organization or actor role
  const availableProfiles = useMemo(() => {
    if (effectiveRole === 'MARKETEUR') {
      return PREDEFINED_PROFILES.filter((p) => p.targetOrgType === 'MARKETEUR' || p.targetOrgType === 'ALL')
    }
    if (effectiveRole === 'TRANSPORTEUR') {
      return PREDEFINED_PROFILES.filter((p) => p.targetOrgType === 'TRANSPORTEUR' || p.targetOrgType === 'ALL')
    }
    return PREDEFINED_PROFILES
  }, [effectiveRole])

  // Filter organizations list (live `organizationOptions` is loaded in the
  // effect above; no curated.* fallback).

  // Selected organization info
  const currentOrg = useMemo(() => {
    return organizationOptions.find((o) => o.id === form.org_id)
  }, [organizationOptions, form.org_id])

  // Site assignment options, from live rows only.
  const sitesQuery = sitesHooks.useList({ limit: 200 })
  const orgsQuery = organizationsHooks.useList({ limit: 200 })

  const availableSites = useMemo(() => {
    const orgRows = orgsQuery.data ?? []
    const orgsById: Record<string, string> = {}
    for (const org of orgRows) orgsById[org.id] = org.name
    const all = getSites(sitesQuery.data ?? [], orgsById)
    if (!form.org_id) return all
    const orgNameLower = currentOrg?.name?.toLowerCase() ?? ''
    const orgSites = orgNameLower
      ? all.filter((s) => s.operator.toLowerCase().includes(orgNameLower))
      : all
    return orgSites.length > 0 ? orgSites : all
  }, [form.org_id, currentOrg, sitesQuery.data, orgsQuery.data])

  // Active base permissions from system_role
  const baseRolePermissions = useMemo<readonly PermissionCode[]>(() => {
    return ROLE_GRANTS[form.system_role] || []
  }, [form.system_role])

  // Categorized permissions
  const permissionCategories = useMemo(() => {
    type CatKey = 'approvisionnements' | 'livraisons' | 'flotte' | 'declarations' | 'supervision' | 'reporting' | 'administration'
    const categories: Record<CatKey, { label: string; items: typeof PERMISSION_CATALOG[number][] }> = {
      approvisionnements: { label: 'Approvisionnements (Flux 1) & Quotas', items: [] },
      livraisons: { label: 'Tournées & Livraisons (Flux 2)', items: [] },
      flotte: { label: 'Flotte, Camions & Chauffeurs', items: [] },
      declarations: { label: 'Déclarations & Subventions', items: [] },
      supervision: { label: 'Supervision, Alertes & Risques', items: [] },
      reporting: { label: 'Rapports & Métriques', items: [] },
      administration: { label: 'Administration & Utilisateurs', items: [] },
    }

    for (const perm of PERMISSION_CATALOG) {
      if (perm.code.startsWith('pickup') || perm.code.startsWith('quota') || perm.code.startsWith('supply')) {
        categories.approvisionnements.items.push(perm)
      } else if (perm.code.startsWith('tour') || perm.code.startsWith('deliver') || perm.code.startsWith('mission') || perm.code.startsWith('checkpoint') || perm.code.startsWith('scan')) {
        categories.livraisons.items.push(perm)
      } else if (perm.code.startsWith('truck') || perm.code.startsWith('driver') || perm.code.startsWith('livreur') || perm.code.startsWith('pda') || perm.code.startsWith('device') || perm.code.startsWith('rfid')) {
        categories.flotte.items.push(perm)
      } else if (perm.code.startsWith('declaration') || perm.code.startsWith('subsid') || perm.code.startsWith('invoice') || perm.code.startsWith('reconcil')) {
        categories.declarations.items.push(perm)
      } else if (perm.code.startsWith('anomal') || perm.code.startsWith('risk') || perm.code.startsWith('alert') || perm.code.startsWith('site')) {
        categories.supervision.items.push(perm)
      } else if (perm.code.startsWith('report') || perm.code.startsWith('metric') || perm.code.startsWith('overview') || perm.code.startsWith('dashboard')) {
        categories.reporting.items.push(perm)
      } else {
        categories.administration.items.push(perm)
      }
    }

    return Object.entries(categories).filter(([_, val]) => val.items.length > 0)
  }, [])

  function getCategoryIcon(catKey: string) {
    switch (catKey) {
      case 'approvisionnements':
        return <Package className='h-4 w-4' />
      case 'livraisons':
        return <Truck className='h-4 w-4' />
      case 'flotte':
        return <Fuel className='h-4 w-4' />
      case 'declarations':
        return <FileText className='h-4 w-4' />
      case 'supervision':
        return <ShieldAlert className='h-4 w-4' />
      case 'reporting':
        return <BarChart3 className='h-4 w-4' />
      case 'administration':
      default:
        return <Users2 className='h-4 w-4' />
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleProfileSelect(profileId: string) {
    const profile = availableProfiles.find((p) => p.id === profileId)
    if (!profile) return

    setForm((prev) => ({
      ...prev,
      selected_profile_id: profileId,
      system_role: profile.baseRole,
      job_title: prev.job_title || profile.name,
      custom_permissions: profile.defaultPermissions ? [...profile.defaultPermissions] : [],
    }))
  }

  function toggleCustomPermission(code: string) {
    setForm((prev) => {
      const exists = prev.custom_permissions.includes(code)
      if (exists) {
        return {
          ...prev,
          custom_permissions: prev.custom_permissions.filter((c) => c !== code),
        }
      }
      return {
        ...prev,
        custom_permissions: [...prev.custom_permissions, code],
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setSubmitError('Le prénom et le nom de famille sont obligatoires.')
      return
    }

    if (!form.email.trim() || !form.email.includes('@')) {
      setSubmitError('Veuillez renseigner une adresse email valide.')
      return
    }

    if (!form.org_id) {
      setSubmitError('Une organisation de rattachement est obligatoire.')
      return
    }

    const patch = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      job_title: form.job_title.trim() || undefined,
      org_id: form.org_id,
      site_id: form.site_id && form.site_id !== 'none' ? form.site_id : undefined,
      system_role: form.system_role,
      custom_permissions: form.custom_permissions,
      is_active: form.is_active,
    }

    setSubmitting(true)
    setSubmitError(null)
    ;(async () => {
      try {
        if (mode === 'create') {
          // Generate a username from email + a default password for first-time
          // login. The user-service /users/with-auth endpoint requires both.
          const username = patch.email.split('@')[0]?.replace(/[^a-zA-Z0-9._-]/g, '') || `${patch.first_name}.${patch.last_name}`.toLowerCase()
          const password = form.temp_password || 'Password123!'
          await useUsersStore.getState().createUser({
            ...patch,
            username,
            password,
          } as never)
          toast.success(`Collaborateur ${patch.first_name} ${patch.last_name} créé en base avec succès !`)
        } else {
          await useUsersStore.getState().updateUser(initialUser!.id, patch)
          toast.success(`Profil de ${patch.first_name} ${patch.last_name} mis à jour en base avec succès !`)
        }
        navigate({ to: '/users' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur réseau — création non confirmée.'
        setSubmitError(message)
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <div className='mx-auto max-w-5xl space-y-6 pb-16 pt-2'>
      {/* Header & Breadcrumb */}
      <div className='flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4'>
        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            size='icon'
            onClick={() => navigate({ to: '/users' })}
            className='h-9 w-9'
          >
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {mode === 'create'
                  ? 'Nouveau collaborateur & utilisateur'
                  : `Modifier ${initialUser?.fullName}`}
              </h1>
              <Badge variant='outline' className='text-xs font-semibold'>
                {ROLE_LABELS[form.system_role] || form.system_role}
              </Badge>
            </div>
            <p className='text-sm text-muted-foreground'>
              {mode === 'create'
                ? 'Création d’un compte utilisateur avec affectation de rôle prédéfini et réglage granulaire des permissions.'
                : `Gestion du profil et des permissions pour ${initialUser?.email}`}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            onClick={() => navigate({ to: '/users' })}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className='flex items-center gap-2 shadow-sm'
          >
            <Save className='h-4 w-4' />
            {submitting
              ? 'Envoi…'
              : mode === 'create'
                ? 'Créer l’utilisateur'
                : 'Enregistrer les modifications'}
          </Button>
        </div>
      </div>

      {submitError && (
        <div className='rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300'>
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* Section 1 : Identité & Contact */}
        <Card className='border-border/60 shadow-sm'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2 text-primary'>
              <UserIcon className='h-5 w-5' />
              <CardTitle className='text-base font-semibold'>
                1. Informations Personnelles & Identité
              </CardTitle>
            </div>
            <CardDescription>
              Données civiles et coordonnées professionnelles de la personne.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label htmlFor='first_name' className='text-sm font-medium'>
                  Prénom <span className='text-rose-500'>*</span>
                </Label>
                <Input
                  id='first_name'
                  placeholder='ex: Paul'
                  value={form.first_name}
                  onChange={(e) => update('first_name', e.target.value)}
                  required
                />
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='last_name' className='text-sm font-medium'>
                  Nom de famille <span className='text-rose-500'>*</span>
                </Label>
                <Input
                  id='last_name'
                  placeholder='ex: Ndongo'
                  value={form.last_name}
                  onChange={(e) => update('last_name', e.target.value)}
                  required
                />
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='email' className='text-sm font-medium'>
                  Adresse Email professionnelle <span className='text-rose-500'>*</span>
                </Label>
                <div className='relative'>
                  <Mail className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    id='email'
                    type='email'
                    placeholder='ex: paul.ndongo@sctm.cm'
                    className='pl-9'
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='phone' className='text-sm font-medium'>
                  Numéro de Téléphone
                </Label>
                <div className='relative'>
                  <Phone className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    id='phone'
                    placeholder='ex: +237 699 00 00 00'
                    className='pl-9'
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                  />
                </div>
              </div>

              <div className='space-y-1.5 sm:col-span-2'>
                <Label htmlFor='job_title' className='text-sm font-medium'>
                  Fonction / Titre dans l'organisation
                </Label>
                <Input
                  id='job_title'
                  placeholder='ex: Responsable Logistique et Gestion des Stocks'
                  value={form.job_title}
                  onChange={(e) => update('job_title', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2 : Rattachement Organisationnel & Site */}
        <Card className='border-border/60 shadow-sm'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2 text-primary'>
              <Building2 className='h-5 w-5' />
              <CardTitle className='text-base font-semibold'>
                2. Rattachement Organisationnel & Affectation de Site
              </CardTitle>
            </div>
            <CardDescription>
              Structure légale et site principal d'exploitation où intervient ce collaborateur.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label htmlFor='org_id' className='text-sm font-medium'>
                  Organisation de rattachement <span className='text-rose-500'>*</span>
                </Label>
                {isActorOrganizationLocked ? (
                  <div className='flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 p-2.5'>
                    <Building2 className='h-4 w-4 text-muted-foreground' />
                    <span className='flex-1 text-sm font-medium'>
                      {currentOrg?.name || userOrgId}
                    </span>
                    <Badge variant='secondary' className='text-xs'>
                      Verrouillé à votre compte
                    </Badge>
                  </div>
                ) : (
                  <Select
                    value={form.org_id}
                    onValueChange={(val) => update('org_id', val)}
                  >
                    <SelectTrigger id='org_id'>
                      <SelectValue placeholder='Sélectionner une organisation' />
                    </SelectTrigger>
                    <SelectContent>
                      {organizationOptions.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} ({org.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='site_id' className='text-sm font-medium'>
                  Site principal d'affectation
                </Label>
                <div className='relative'>
                  <Select
                    value={form.site_id}
                    onValueChange={(val) => update('site_id', val)}
                  >
                    <SelectTrigger id='site_id'>
                      <SelectValue placeholder='Sélectionner un site principal' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>Aucun site spécifique (Siège / Direction)</SelectItem>
                      {availableSites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name} — {site.city} ({site.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3 : Profil Métier & Rôle Prédéfini */}
        <Card className='border-border/60 shadow-sm'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2 text-primary'>
              <ShieldCheck className='h-5 w-5' />
              <CardTitle className='text-base font-semibold'>
                3. Groupe Métier & Profil Prédéterminé
              </CardTitle>
            </div>
            <CardDescription>
              Sélectionnez un profil préconfiguré pour attribuer immédiatement les droits métiers standard.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3'>
              {availableProfiles.map((profile) => {
                const isSelected = form.selected_profile_id === profile.id
                return (
                  <div
                    key={profile.id}
                    onClick={() => handleProfileSelect(profile.id)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                        : 'border-border/70 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <span className='font-semibold text-sm leading-tight'>
                        {profile.name}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className='h-4 w-4 shrink-0 text-primary' />
                      )}
                    </div>
                    <Badge variant='outline' className='mt-1.5 text-[11px] font-medium'>
                      Rôle : {ROLE_LABELS[profile.baseRole]}
                    </Badge>
                    <p className='mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2'>
                      {profile.description}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className='rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2'>
              <Shield className='h-4 w-4 text-primary shrink-0' />
              <span>
                Le rôle système canonique appliqué à ce compte est <strong>{ROLE_LABELS[form.system_role]}</strong>. Vous pouvez affiner ou ajouter des droits complémentaires ci-dessous.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Section 4 : Personnalisation Granulaire des Permissions en mode Collapsible */}
        <Card className='border-border/60 shadow-sm'>
          <CardHeader className='pb-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='flex items-center gap-2 text-primary'>
                <Lock className='h-5 w-5' />
                <div>
                  <CardTitle className='text-base font-semibold'>
                    4. Personnalisation Granulaire des Permissions
                  </CardTitle>
                  <CardDescription>
                    Sections déroulantes par domaine d’activité. Cochez les droits additionnels souhaités pour ce collaborateur.
                  </CardDescription>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <Badge variant='secondary' className='text-xs font-semibold'>
                  {form.custom_permissions.length} droit(s) spécifique(s) accordé(s)
                </Badge>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const allOpen = Object.values(collapsedCategories).every((v) => !v)
                    if (allOpen) collapseAll()
                    else expandAll()
                  }}
                  className='h-8 text-xs flex items-center gap-1.5'
                >
                  <ChevronsUpDown className='h-3.5 w-3.5' />
                  {Object.values(collapsedCategories).every((v) => !v)
                    ? 'Tout replier'
                    : 'Tout déplier'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3.5'>
            {permissionCategories.map(([catKey, category]) => {
              const isCollapsed = collapsedCategories[catKey] ?? false
              const activeCountInCat = category.items.filter((p) =>
                baseRolePermissions.includes(p.code as PermissionCode) || form.custom_permissions.includes(p.code)
              ).length
              const customCountInCat = category.items.filter((p) =>
                form.custom_permissions.includes(p.code) && !baseRolePermissions.includes(p.code as PermissionCode)
              ).length

              return (
                <Collapsible
                  key={catKey}
                  open={!isCollapsed}
                  onOpenChange={() => toggleCategoryCollapse(catKey)}
                  className='rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs transition-all'
                >
                  <CollapsibleTrigger asChild>
                    <div className='flex items-center justify-between p-3.5 cursor-pointer hover:bg-muted/40 transition-colors select-none'>
                      <div className='flex items-center gap-3'>
                        <div className='rounded-lg bg-primary/10 p-2 text-primary'>
                          {getCategoryIcon(catKey)}
                        </div>
                        <div className='text-left'>
                          <h4 className='text-sm font-semibold text-foreground leading-tight'>
                            {category.label}
                          </h4>
                          <p className='text-xs text-muted-foreground'>
                            {category.items.length} permission(s) au catalogue
                          </p>
                        </div>
                      </div>

                      <div className='flex items-center gap-3'>
                        <div className='flex items-center gap-1.5'>
                          <Badge variant='outline' className='text-[11px] font-mono'>
                            {activeCountInCat} / {category.items.length} active(s)
                          </Badge>
                          {customCountInCat > 0 && (
                            <Badge variant='secondary' className='text-[11px] font-semibold text-sky-600 dark:text-sky-400'>
                              +{customCountInCat} sur-mesure
                            </Badge>
                          )}
                        </div>
                        <div className='rounded-md p-1 hover:bg-muted text-muted-foreground'>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${
                              !isCollapsed ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className='border-t border-border/40 divide-y divide-border/40 bg-muted/10'>
                      {category.items.map((perm) => {
                        const isBaseGranted = baseRolePermissions.includes(perm.code as PermissionCode)
                        const isCustomGranted = form.custom_permissions.includes(perm.code)
                        const isChecked = isBaseGranted || isCustomGranted

                        return (
                          <div
                            key={perm.code}
                            onClick={() => {
                              if (!isBaseGranted) toggleCustomPermission(perm.code)
                            }}
                            className={`flex items-center justify-between px-4 py-3 text-xs transition-colors cursor-pointer ${
                              isBaseGranted
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/15 cursor-default'
                                : isCustomGranted
                                  ? 'bg-sky-50/60 dark:bg-sky-950/25 hover:bg-sky-50/80'
                                  : 'hover:bg-muted/40'
                            }`}
                          >
                            <div className='flex items-center gap-3.5 flex-1'>
                              <Checkbox
                                id={`perm-${perm.code}`}
                                checked={isChecked}
                                disabled={isBaseGranted}
                                onCheckedChange={() => toggleCustomPermission(perm.code)}
                                className='size-4 mt-0.5'
                              />
                              <div className='flex flex-col gap-0.5'>
                                <label
                                  htmlFor={`perm-${perm.code}`}
                                  className={`text-sm font-medium leading-none cursor-pointer ${
                                    isBaseGranted ? 'cursor-default text-foreground font-semibold' : 'text-foreground'
                                  }`}
                                >
                                  {perm.label}
                                </label>
                                <span className='font-mono text-[11px] text-muted-foreground'>
                                  {perm.code}
                                </span>
                              </div>
                            </div>

                            <div className='flex items-center gap-2 shrink-0 ps-3'>
                              {isBaseGranted ? (
                                <Badge
                                  variant='outline'
                                  className='border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]'
                                >
                                  ✓ Inclus dans le rôle
                                </Badge>
                              ) : isCustomGranted ? (
                                <Badge
                                  variant='outline'
                                  className='border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold text-[11px]'
                                >
                                  ★ Droit accordé
                                </Badge>
                              ) : (
                                <span className='text-[11px] text-muted-foreground/60 font-mono'>
                                  Non attribué
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </CardContent>
        </Card>

        {/* Section 5 : Sécurité & Accès Plateforme */}
        <Card className='border-border/60 shadow-sm'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2 text-primary'>
              <KeyRound className='h-5 w-5' />
              <CardTitle className='text-base font-semibold'>
                5. Compte d'Accès Plateforme & Sécurité
              </CardTitle>
            </div>
            <CardDescription>
              Statut du compte et paramètres d'authentification initiale.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between rounded-lg border border-border/70 p-3'>
              <div className='space-y-0.5'>
                <Label className='text-sm font-medium'>Statut du compte</Label>
                <p className='text-xs text-muted-foreground'>
                  Un compte inactif ne peut pas se connecter ni exécuter d'actions sur la plateforme.
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(val) => update('is_active', val)}
                />
                <Badge variant={form.is_active ? 'default' : 'secondary'} className='text-xs'>
                  {form.is_active ? 'Actif' : 'Désactivé'}
                </Badge>
              </div>
            </div>

            {mode === 'create' && (
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2'>
                <div className='space-y-1.5'>
                  <Label htmlFor='temp_password' className='text-sm font-medium'>
                    Mot de passe initial provisoire
                  </Label>
                  <Input
                    id='temp_password'
                    type='text'
                    value={form.temp_password}
                    onChange={(e) => update('temp_password', e.target.value)}
                  />
                  <p className='text-[11px] text-muted-foreground'>
                    Communiqué au collaborateur lors de sa première connexion.
                  </p>
                </div>

                <div className='flex items-center justify-between rounded-lg border border-border/70 p-3 self-end'>
                  <div className='space-y-0.5'>
                    <Label className='text-sm font-medium'>Forcer le changement de mot de passe</Label>
                    <p className='text-xs text-muted-foreground'>
                      Exige un nouveau mot de passe dès le premier login.
                    </p>
                  </div>
                  <Switch
                    checked={form.must_change_password}
                    onCheckedChange={(val) => update('must_change_password', val)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Actions */}
        <div className='flex items-center justify-end gap-3 pt-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => navigate({ to: '/users' })}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type='submit' size='lg' disabled={submitting} className='flex items-center gap-2 px-6 shadow-sm'>
            <Save className='h-4 w-4' />
            {submitting
              ? 'Envoi…'
              : mode === 'create'
                ? 'Créer le collaborateur'
                : 'Enregistrer les modifications'}
          </Button>
        </div>
      </form>
    </div>
  )
}
