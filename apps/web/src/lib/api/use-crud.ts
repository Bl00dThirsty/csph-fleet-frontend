/**
 * Generic CRUD data-access layer over `@lpg/api-client`.
 *
 * Every write goes through `api.<resource>` (the HTTP adapter, straight at the
 * Spring backend) — never a local mutation. The fake adapter is deleted, so
 * there is no in-memory mode anymore.
 *
 * Reads + cache invalidation use React Query, matching the existing
 * `lib/api/use-resources.ts` convention. This is the single data-source of
 * truth for list pages — no second Zustand mirror.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@lpg/api-client'
import type { Resource } from '@lpg/permissions'

type ApiResources = typeof api

/** Union of every api resource that exposes create/patch/remove. */
export type CrudResource = {
  [K in keyof ApiResources]: ApiResources[K] extends {
    create: (...a: never[]) => unknown
    patch: (...a: never[]) => unknown
    remove: (...a: never[]) => unknown
  }
    ? K
    : never
}[keyof ApiResources]

export interface UseCrudOptions {
  /** Permission resource used for gating (may differ from the api key). */
  permissionResource?: Resource
  /** React Query key prefix for cache invalidation. */
  queryKey?: string[]
}

export function useCrud<T extends { id: string }>(
  resource: CrudResource,
  options: UseCrudOptions = {},
) {
  const qc = useQueryClient()
  const baseKey = options.queryKey ?? [resource as string]

  const list = useQuery<T[]>({
    queryKey: [...baseKey, 'list'],
    queryFn: () => api[resource].list().then((r) => r.data as T[]),
  })

  const createMut = useMutation<T, Error, Partial<T>>({
    mutationFn: (body) => api[resource].create(body as Omit<T, 'id'>),
    onSuccess: () => qc.invalidateQueries({ queryKey: baseKey }),
  })

  const updateMut = useMutation<T, Error, { id: string; patch: Partial<T> }>({
    mutationFn: ({ id, patch }) => api[resource].patch(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: baseKey }),
  })

  const removeMut = useMutation<void, Error, string>({
    mutationFn: (id) => api[resource].remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: baseKey }),
  })

  return { list, createMut, updateMut, removeMut }
}
