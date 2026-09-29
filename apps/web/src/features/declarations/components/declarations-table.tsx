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
import { getDeclarationColumns } from './declarations-columns'
import { declarationStatusOptions, type DeclarationView } from '../data/declarations'

export function DeclarationsTable({ rows, search, navigate }: { rows: DeclarationView[]; search: Record<string, unknown>; navigate: NavigateFn }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [grouping, setGrouping] = useState<GroupingState>([])
  const [expanded, setExpanded] = useState({})
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
      { columnId: 'status', searchKey: 'status', type: 'array', deserialize: toFilterArray },
      { columnId: 'submitted_at', searchKey: 'period', type: 'daterange' },
    ],
  })

  const columns = useMemo(() => getDeclarationColumns(), [])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination, grouping, expanded, columnFilters },
    onSortingChange: setSorting,
    onPaginationChange,
    onColumnFiltersChange,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    enableGrouping: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  const dateColumn = table.getColumn('submitted_at')
  const dateBounds = (dateColumn?.getFilterValue() as
    | { from?: string | Date; to?: string | Date }
    | undefined) ?? {}

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <DataTableToolbar
          table={table}
          searchPlaceholder='Rechercher une référence, marketeur...'
          searchKey='reference'
          filters={[{ columnId: 'status', title: 'Statut', options: declarationStatusOptions }]}
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
            <option value=''>—</option>
            <option value='status'>Statut</option>
            <option value='marketeur_name'>Marketeur</option>
            <option value='period'>Période</option>
            <option value='volume_label'>Volume déclaré</option>
          </select>
        </div>
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
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'group/row',
                    row.getIsGrouped() && 'bg-muted/40 font-medium'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {cell.getIsGrouped() ? (
                        <button
                          type='button'
                          className='flex items-center gap-2 text-primary'
                          onClick={row.getToggleExpandedHandler()}
                        >
                          {row.getIsExpanded() ? '▼' : '▶'}{' '}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())} ({row.subRows.length})
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
                  Aucune déclaration.
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