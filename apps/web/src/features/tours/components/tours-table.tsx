import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type GroupingState,
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
import { getToursColumns } from './tours-columns'
import { tourStatusOptions, executionModeOptions, type TourActivity } from '../data/tour-activity'

export function ToursTable({
  rows,
  selectedTripId,
  onOpenDetails,
  search,
  navigate,
}: {
  rows: TourActivity[]
  selectedTripId?: string | null
  onOpenDetails: (row: TourActivity) => void
  search: Record<string, unknown>
  navigate: NavigateFn
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [grouping, setGrouping] = useState<GroupingState>([])
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
      { columnId: 'tourneeStatus', searchKey: 'status', type: 'array', deserialize: toFilterArray },
      { columnId: 'execution_mode', searchKey: 'mode', type: 'array', deserialize: toFilterArray },
      { columnId: 'startedAt', searchKey: 'period', type: 'daterange' },
    ],
  })

  const columns = useMemo(
    () => getToursColumns({ onOpenDetails, selectedTripId }),
    [onOpenDetails, selectedTripId],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination, grouping, columnFilters },
    onSortingChange: setSorting,
    onPaginationChange,
    onColumnFiltersChange,
    onGroupingChange: setGrouping,
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  const dateColumn = table.getColumn('startedAt')
  const dateBounds = (dateColumn?.getFilterValue() as
    | { from?: string | Date; to?: string | Date }
    | undefined) ?? {}

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <DataTableToolbar
          table={table}
          searchPlaceholder='Rechercher une reference, marketeur...'
          searchKey='reference'
          filters={[
            { columnId: 'tourneeStatus', title: 'Statut', options: tourStatusOptions },
            { columnId: 'execution_mode', title: 'Mode', options: executionModeOptions },
          ]}
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
        <div className='flex items-center gap-2'>
          <span className='text-xs text-muted-foreground'>Grouper par</span>
          <select
            value={grouping[0] ?? ''}
            onChange={(e) => setGrouping(e.target.value ? [e.target.value] : [])}
            className='h-8 rounded-md border bg-background px-2 text-sm'
          >
            <option value=''>--</option>
            <option value='execution_mode'>Mode</option>
            <option value='tourneeStatus'>Statut</option>
          </select>
        </div>
      </div>
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(header.column.columnDef.meta?.className)}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={
                    row.original.id === selectedTripId ? 'selected' : undefined
                  }
                  className={cn(
                    row.original.id === selectedTripId && 'bg-primary/5 hover:bg-primary/10',
                    row.getIsGrouped() && 'bg-muted/40 font-medium',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.columnDef.meta?.className)}
                    >
                      {cell.getIsGrouped() ? (
                        <button
                          type='button'
                          className='flex items-center gap-2 text-primary'
                          onClick={row.getToggleExpandedHandler()}
                        >
                          {row.getIsExpanded() ? '▼' : '▶'} {flexRender(cell.column.columnDef.cell, cell.getContext())} ({row.subRows.length})
                        </button>
                      ) : cell.getIsPlaceholder() ? null : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  Aucune tournée ne correspond aux filtres.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
