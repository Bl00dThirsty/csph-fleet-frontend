import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { DataTablePagination, DataTableToolbar, DateRangeFilter } from '@lpg/ui'
import { cn } from '@/lib/utils'
import { toDateOrUndefined, toFilterArray } from '@/lib/table-filters'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { getPickupsColumns } from './pickups-columns'
import { pickupStatusOptions, type Pickup } from '../data/pickups'

export function PickupsTable({
  rows,
  onOpenDetails,
  search,
  navigate,
}: {
  rows: Pickup[]
  onOpenDetails: (row: Pickup) => void
  search: Record<string, unknown>
  navigate: NavigateFn
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'reference', searchKey: 'q', type: 'string' },
      { columnId: 'pickup_status', searchKey: 'status', type: 'array', deserialize: toFilterArray },
      { columnId: 'requested_at', searchKey: 'period', type: 'daterange' },
    ],
  })

  const columns = useMemo(() => getPickupsColumns({ onOpenDetails }), [onOpenDetails])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination, columnFilters },
    onSortingChange: setSorting,
    onPaginationChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  const dateColumn = table.getColumn('requested_at')
  const dateBounds = (dateColumn?.getFilterValue() as
    | { from?: string | Date; to?: string | Date }
    | undefined) ?? {}

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <DataTableToolbar
          table={table}
          searchPlaceholder='Rechercher une référence, marketeur...'
          searchKey='reference'
          filters={[{ columnId: 'pickup_status', title: 'Statut', options: pickupStatusOptions }]}
        />
        <DateRangeFilter
          value={{
            from: toDateOrUndefined(dateBounds.from),
            to: toDateOrUndefined(dateBounds.to),
          }}
          onChange={(v) =>
            dateColumn?.setFilterValue(v.from || v.to ? v : undefined)
          }
        />
      </div>
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className={cn(header.column.columnDef.meta?.className)}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  Aucun enlèvement.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}