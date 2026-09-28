import { useState } from 'react'
import { MapIcon, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { NationalMap } from './components/national-map'
import { NationalMapFilters } from './components/national-map-filters'
import { getInitialLayers, type MapLayerKey } from './lib/layers'

export function NationalMapPage() {
  const [layers, setLayers] = useState<Record<MapLayerKey, boolean>>(
    getInitialLayers(),
  )

  const toggleLayer = (key: MapLayerKey, enabled: boolean) => {
    setLayers((prev) => ({ ...prev, [key]: enabled }))
  }

  return (
    <main
      id="main-content"
      className="relative flex-1 space-y-4 bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 sm:p-6 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
    >
      <section className="rounded-2xl border-transparent bg-background/88 p-3 shadow-sm backdrop-blur-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <MapIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Carte interactive</h1>
          <Badge variant="outline" className="ml-auto">
            SUPERADMIN
          </Badge>
        </div>
      </section>

      <section className="relative rounded-xl border-transparent bg-background/92 p-4 shadow-sm">
        <NationalMapFilters layers={layers} onChange={toggleLayer} />
        <NationalMap className="h-[700px] w-full rounded-lg" />
      </section>

      <section className="rounded-xl border-transparent bg-background/92 p-3 text-xs text-muted-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-4 w-4" />
          Les donnÃ©es affichÃ©es proviennent du jeu de graine local
          ({'@/lib/entity-data'}). Les volumes VRAC sont exprimÃ©s en tonnes mÃ©triques
          (TM) â€” jamais en kg.
        </div>
      </section>
    </main>
  )
}
