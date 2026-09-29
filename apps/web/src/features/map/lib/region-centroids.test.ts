import { describe, it, expect } from 'vitest'
import { computeRegionCentroids } from './region-centroids'
import type { Region } from '@lpg/types'

const regions: readonly { code: Region; name: string }[] = [
  { code: 'CENTRE', name: 'Centre' },
  { code: 'LITTORAL', name: 'Littoral' },
  { code: 'EST', name: 'Est' },
]

describe('computeRegionCentroids', () => {
  it('averages the coordinates of every point in a region', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'CENTRE', longitude: 10, latitude: 2 },
      { region: 'CENTRE', longitude: 14, latitude: 6 },
    ])
    const centre = result.find((r) => r.code === 'CENTRE')
    expect(centre?.longitude).toBe(12)
    expect(centre?.latitude).toBe(4)
  })

  it('omits regions that have no geocoded points', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'CENTRE', longitude: 11, latitude: 3 },
    ])
    expect(result).toHaveLength(1)
    expect(result.some((r) => r.code === 'LITTORAL')).toBe(false)
    expect(result.some((r) => r.code === 'EST')).toBe(false)
  })

  it('never returns a 0,0 coordinate for an empty region', () => {
    const result = computeRegionCentroids(regions, [])
    expect(result).toEqual([])
  })

  it('returns one summary per region, carrying its name and counts at zero', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'LITTORAL', longitude: 9.7, latitude: 4.05 },
    ])
    const littoral = result.find((r) => r.code === 'LITTORAL')
    expect(littoral?.name).toBe('Littoral')
    expect(littoral?.siteCount).toBe(0)
    expect(littoral?.clientSiteCount).toBe(0)
    expect(littoral?.anomalyCount).toBe(0)
  })

  it('handles a single point without dividing by zero', () => {
    const result = computeRegionCentroids(regions, [
      { region: 'CENTRE', longitude: 11.5, latitude: 3.87 },
    ])
    const centre = result.find((r) => r.code === 'CENTRE')
    expect(centre?.longitude).toBe(11.5)
    expect(centre?.latitude).toBe(3.87)
  })
})
