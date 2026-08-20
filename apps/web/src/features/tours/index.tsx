import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell, SectionCard } from '@/components/layout/page'
import { Button } from '@lpg/ui'
import { useToursStore } from '@/store/tours-store'
import { TourActiveHeader } from './components/tour-active-header'
import { ToursTable } from './components/tours-table'
import { TourCreateDialog } from './components/tour-create-dialog'
import { type TourSlice } from './data/tour-activity'

const SLICES: { value: TourSlice; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'INTERNAL', label: 'Internes' },
  { value: 'EXTERNAL', label: 'Externalisées' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'ACTIVE', label: 'Actives' },
  { value: 'HISTORY', label: 'Historique' },
]

export function ToursPage() {
  const navigate = useNavigate()
  const [slice, setSlice] = useState<TourSlice>('ALL')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const tours = useToursStore((s) => s.views(slice))
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const selectedTrip = tours.find((t) => t.id === selectedId) ?? tours[0]

  useEffect(() => {
    useToursStore.getState().fetchTours()
  }, [])

  function openDetail(id: string) {
    navigate({ to: '/tour-tracking/$tourId', params: { tourId: id } })
  }

  return (
    <PageShell>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <PageHeader
          title='Tournées de livraison'
          description='Flux 2 — livraisons créées par les marketeurs et exécutées en interne ou par un transporteur.'
        />
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className='flex items-center gap-2'
        >
          <Plus className='h-4 w-4' />
          Nouvelle tournée
        </Button>
      </div>

      {selectedTrip && (
        <TourActiveHeader
          trip={selectedTrip}
          trips={tours}
          onSelectTrip={(id) => setSelectedId(id)}
        />
      )}

      <SectionCard>
        <div className='mb-4 flex flex-wrap gap-2'>
          {SLICES.map((s) => (
            <button
              key={s.value}
              type='button'
              onClick={() => { setSlice(s.value); setSelectedId(undefined) }}
              className={
                slice === s.value
                  ? 'rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                  : 'rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted'
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <ToursTable
          rows={tours}
          selectedTripId={selectedTrip?.id}
          onOpenDetails={(row) => openDetail(row.id)}
        />
      </SectionCard>

      <TourCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setSelectedId(undefined)
        }}
      />
    </PageShell>
  )
}