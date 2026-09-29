import { type ColumnDef } from '@tanstack/react-table'
import { arrIncludesCell, dateInRange } from '@/lib/table-filters'
import { formatFrDate } from '@/lib/utils'
import { Badge } from '@lpg/ui'
import { DataTableColumnHeader } from '@/components/data-table'
import {
  type DeclarationView,
  type DeclarationStatus,
  declarationStatusLabels,
} from '../data/declarations'
import { DeclarationRowActions } from './declaration-row-actions'

const STATUS_CLASS: Record<DeclarationStatus, string> = {
  DRAFT: 'bg-slate-200 text-slate-800',
  SUBMITTED: 'bg-sky-100 text-sky-800',
  RECONCILED: 'bg-emerald-600 text-white',
  DISPUTED: 'bg-rose-100 text-rose-900',
}

export function getDeclarationColumns(): ColumnDef<DeclarationView>[] {
  return [
    {
      accessorKey: 'reference',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Reference' />,
      cell: ({ row }) => <span className='font-medium text-primary'>{row.original.reference}</span>,
      enableHiding: false,
      meta: { label: 'Reference' },
    },
    {
      accessorKey: 'marketeur_name',
      header: 'Marketeur',
      cell: ({ row }) => row.original.marketeur_name,
      meta: { label: 'Marketeur' },
      enableGrouping: true,
    },
    {
      accessorKey: 'period',
      header: 'Periode',
      cell: ({ row }) => row.original.period,
      meta: { label: 'Periode' },
      enableGrouping: true,
    },
    {
      accessorKey: 'volume_label',
      header: 'Volume declare',
      cell: ({ row }) => row.original.volume_label,
      meta: { label: 'Volume declare' },
      enableGrouping: true,
    },
    {
      accessorKey: 'status',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge className={STATUS_CLASS[row.original.status]}>
          {declarationStatusLabels[row.original.status]}
        </Badge>
      ),
      enableHiding: false,
      meta: { label: 'Statut' },
      filterFn: arrIncludesCell,
      enableGrouping: true,
    },
    {
      accessorKey: 'submitted_at',
      header: 'Soumise le',
      cell: ({ row }) => (
        <span className='whitespace-nowrap text-xs'>{formatFrDate(row.original.submitted_at)}</span>
      ),
      meta: { label: 'Soumise le' },
      filterFn: dateInRange,
      enableGrouping: true,
    },
    {
      id: 'actions',
      cell: ({ row }) => <DeclarationRowActions row={row.original} />,
      enableSorting: false,
      enableHiding: false,
    },
  ]
}