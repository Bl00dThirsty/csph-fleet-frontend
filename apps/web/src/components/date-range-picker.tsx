import { useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { fr } from 'react-day-picker/locale'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  formatRangeLabel,
  presetRange,
  type DateBounds,
  type DateRangePreset,
} from '@/features/dashboard/lib/date-range'
import { cn } from '@/lib/utils'

const PRESETS: { id: Exclude<DateRangePreset, 'custom'>; label: string }[] = [
  { id: '7d', label: '7 j' },
  { id: '30d', label: '30 j' },
  { id: '90d', label: '90 j' },
]

type DateRangePickerProps = {
  value: DateBounds
  onChange: (range: DateBounds) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const applyPreset = (preset: Exclude<DateRangePreset, 'custom'>) => {
    onChange(presetRange(preset))
    setOpen(false)
  }

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) return
    const next = { from: range.from, to: range.to ?? range.from }
    onChange(next)
    if (range.to) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          className='h-9 rounded-lg bg-background text-xs shadow-none'
          aria-label='Choisir la période'
        >
          <CalendarRange data-icon='inline-start' />
          {formatRangeLabel(value.from, value.to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-auto p-0'>
        <div className='flex flex-col gap-2 p-3'>
          <div className='flex items-center gap-1.5'>
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type='button'
                variant='ghost'
                size='sm'
                className={cn('h-7 px-2.5 text-xs')}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
            <span className='ms-auto text-xs text-muted-foreground'>
              Personnalisé : sélectionnez deux dates
            </span>
          </div>
          <Calendar
            mode='range'
            locale={fr}
            captionLayout='dropdown'
            selected={{ from: value.from, to: value.to }}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
