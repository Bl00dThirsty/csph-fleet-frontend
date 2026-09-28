import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lpg/ui'
import { api } from '@lpg/api-client'

export const Route = createFileRoute('/_authenticated/settings/system')({
  component: SystemSettingsPage,
})

interface SettingRow {
  setting_key: string
  setting_value: string
  value_type: string
  category?: string
  description?: string
}

function formatValue(setting: { value_type: string; setting_value: string }) {
  if (setting.value_type === 'BOOLEAN') {
    return setting.setting_value === 'true' ? 'Oui' : 'Non'
  }
  return setting.setting_value
}

function SystemSettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([])
  useEffect(() => {
    let cancelled = false
    api.settings
      .list({ size: 500 })
      .then((res) => {
        if (cancelled) return
        setSettings(((res.data ?? []) as unknown) as SettingRow[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className='mx-auto max-w-2xl p-6 flex flex-col gap-6'>
      <div>
        <h1 className='text-xl font-semibold tracking-tight'>Paramètres globaux</h1>
        <p className='text-sm text-muted-foreground'>
          Configuration clé/valeur de la plateforme (lecture seule).
        </p>
      </div>

      {settings.length === 0 ? (
        <Card>
          <CardContent className='p-6 text-sm text-muted-foreground'>
            Aucun paramètre configuré.
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-3'>
          {settings.map((setting) => (
            <Card key={setting.setting_key}>
              <CardHeader className='pb-2'>
                <div className='flex items-center gap-2'>
                  <CardTitle className='font-mono text-sm'>
                    {setting.setting_key}
                  </CardTitle>
                  {setting.category && (
                    <span className='rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
                      {setting.category}
                    </span>
                  )}
                </div>
                {setting.description && (
                  <CardDescription className='text-sm'>
                    {setting.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className='text-sm'>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>
                    Valeur ({setting.value_type})
                  </span>
                  <span className='font-medium'>{formatValue(setting)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}