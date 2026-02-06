import { booleanIntersects, circle, point } from '@turf/turf'
import type { EvaluatedSegment } from '../types'
import type { DatasetMeta } from '../../data/segmentBuilder'
import type { ZoneIndex } from '../../domain/zones/zoneIndex'
import { getRankBreakdown } from '../../domain/ranking/rank'
import { getPathMidpoint, distanceMeters } from '../../map/geo'
import { reasonTexts } from '../../domain/reasons/reasonText'

export interface DebugBundle {
  generatedAt: string
  pack: {
    meta: DatasetMeta | null
  }
  context: {
    hhmm: string
    includeInferred: boolean
  }
  selectedSegment: {
    id: string
    name: string
    tier: string
    allowedNow: string
    reasonCodes: string[]
    reasons: string[]
    sourceType?: string
    source?: string
    riskTags?: string[]
    path: [number, number][]
  } | null
  ranking: {
    distanceMeters: number | null
    breakdown: ReturnType<typeof getRankBreakdown> | null
  }
  nearbyZones: Array<{
    radiusMeters: number
    total: number
    byType: Record<string, number>
  }>
}

const buildNearbyCounts = (
  zoneIndex: ZoneIndex | null,
  center: [number, number] | null,
  radiusMeters: number,
) => {
  if (!zoneIndex || !center) {
    return { radiusMeters, total: 0, byType: {} }
  }

  const [lon, lat] = center
  const deltaLat = radiusMeters / 111000
  const deltaLon = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180))
  const bbox = {
    minX: lon - deltaLon,
    minY: lat - deltaLat,
    maxX: lon + deltaLon,
    maxY: lat + deltaLat,
  }

  const candidates = zoneIndex.index.search(bbox)
  if (candidates.length === 0) {
    return { radiusMeters, total: 0, byType: {} }
  }

  const searchCircle = circle(point(center), radiusMeters, { units: 'meters' })
  const byType: Record<string, number> = {}
  let total = 0

  candidates.forEach((candidate) => {
    const zone = zoneIndex.zonesById.get(candidate.id)
    if (!zone) {
      return
    }
    if (booleanIntersects(zone.polygon, searchCircle)) {
      total += 1
      byType[zone.type] = (byType[zone.type] ?? 0) + 1
    }
  })

  return { radiusMeters, total, byType }
}

export const buildDebugBundle = (params: {
  meta: DatasetMeta | null
  hhmm: string
  includeInferred: boolean
  selectedSegment: EvaluatedSegment | null
  userLocation: [number, number] | null
  zoneIndex: ZoneIndex | null
}): DebugBundle => {
  const { meta, hhmm, includeInferred, selectedSegment, userLocation, zoneIndex } =
    params

  const distance =
    selectedSegment && userLocation
      ? distanceMeters(userLocation, getPathMidpoint(selectedSegment.path))
      : null

  const breakdown =
    selectedSegment && distance !== null
      ? getRankBreakdown(selectedSegment, distance)
      : null

  const center = selectedSegment ? getPathMidpoint(selectedSegment.path) : null
  const nearbyZones = [
    buildNearbyCounts(zoneIndex, center, 30),
    buildNearbyCounts(zoneIndex, center, 50),
  ]

  return {
    generatedAt: new Date().toISOString(),
    pack: {
      meta,
    },
    context: {
      hhmm,
      includeInferred,
    },
    selectedSegment: selectedSegment
      ? {
          id: selectedSegment.id,
          name: selectedSegment.name,
          tier: selectedSegment.tier,
          allowedNow: selectedSegment.allowedNow,
          reasonCodes: selectedSegment.reasonCodes ?? [],
          reasons:
            selectedSegment.reasonCodes && selectedSegment.reasonCodes.length > 0
              ? reasonTexts(selectedSegment.reasonCodes)
              : selectedSegment.reasons ?? [],
          sourceType: selectedSegment.sourceType,
          source: selectedSegment.source,
          riskTags: selectedSegment.riskTags,
          path: selectedSegment.path,
        }
      : null,
    ranking: {
      distanceMeters: distance,
      breakdown,
    },
    nearbyZones,
  }
}

export const downloadDebugBundle = (bundle: DebugBundle) => {
  if (typeof window === 'undefined') {
    throw new Error('downloadDebugBundle can only run in the browser')
  }

  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `parkking-debug-${new Date().toISOString()}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
