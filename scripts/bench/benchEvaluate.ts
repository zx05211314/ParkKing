import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import type { FeatureCollection, LineString, MultiLineString, Point } from 'geojson'
import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
  type DatasetMeta,
} from '../../src/data/segmentBuilder'
import { loadGeoJson } from '../../src/data/loaders/loadGeoJson.node'
import {
  countParkingSpacesNearSegments,
  type ParkingSpaceCollection,
} from '../../src/data/parkingSpaces'
import { evaluateSegmentWithZones } from '../../src/domain/rules/evaluateSegment'
import { resetClipCacheStats, getClipCacheStats } from '../../src/domain/geometry/clipCache'
import { getZoneIndex } from '../../src/domain/zones/zoneIndex'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from '../../src/domain/zones/makeZones'
import type { Zone } from '../../src/domain/zones/zoneTypes'
import type { Segment } from '../../src/ui/types'

const getArgValue = (flag: string) => {
  const index = process.argv.indexOf(flag)
  if (index === -1) {
    return null
  }
  return process.argv[index + 1] ?? null
}

const computeDistribution = (segments: { tier: string; allowedNow: string }[]) => {
  const distribution: Record<string, number> = {}
  segments.forEach((segment) => {
    const key = `${segment.tier}|${segment.allowedNow}`
    distribution[key] = (distribution[key] ?? 0) + 1
  })
  return distribution
}

export interface BenchmarkResult {
  datasetHash: string
  hhmm: string
  counts: {
    segments: number
    zones: number
    evaluatedFirst: number
    evaluatedSecond: number
  }
  distribution: Record<string, number>
  reasonCodes: {
    coveragePct: number
    counts: Record<string, number>
    byTier: Record<string, Record<string, number>>
  }
  timingsMs: {
    load: number
    buildSegments: number
    buildZones: number
    zoneIndex: number
    evalFirst: number
    evalSecond: number
  }
  cache: {
    hits: number
    misses: number
    size: number
    maxEntries: number
    secondPassHitRate: number | null
  }
}

export const buildBenchmarkSegments = (params: {
  redYellow: FeatureCollection<LineString | MultiLineString>
  parkingSpaces: ParkingSpaceCollection
  signOverrides: FeatureCollection
  inferredCandidates: FeatureCollection<LineString | MultiLineString>
  meta: DatasetMeta
}) => {
  const rawSegments = params.redYellow.features.flatMap((feature, index) =>
    buildSegmentsFromFeature(feature, index, params.meta),
  )
  const inferredSegments = params.inferredCandidates.features.flatMap((feature, index) =>
    buildInferredSegmentsFromFeature(feature, index, params.meta),
  )
  const matchTolerance = params.meta?.signOverrideMatchToleranceMeters ?? 15
  const segmentsWithOverrides = applySignOverrides(
    [...rawSegments, ...inferredSegments],
    params.signOverrides,
    {
      matchToleranceMeters: matchTolerance,
    },
  )

  return countParkingSpacesNearSegments(
    segmentsWithOverrides,
    params.parkingSpaces,
  )
}

export const runBenchmark = async (
  datasetDir: string,
  hhmm: string,
): Promise<BenchmarkResult> => {
  const loadStart = performance.now()
  const [
    redYellow,
    busStops,
    hydrants,
    parkingSpaces,
    intersections,
    crosswalks,
    signOverrides,
    inferredCandidates,
    meta,
  ] = await Promise.all([
    loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
      'red_yellow.geojson',
      { baseDir: datasetDir },
    ),
    loadGeoJson<FeatureCollection<Point>>('bus_stops.geojson', { baseDir: datasetDir }),
    loadGeoJson<FeatureCollection<Point>>('hydrants.geojson', { baseDir: datasetDir }),
    loadGeoJson<ParkingSpaceCollection>('parking_spaces.geojson', { baseDir: datasetDir }),
    loadGeoJson<FeatureCollection<Point>>('intersections.geojson', { baseDir: datasetDir }),
    loadGeoJson<FeatureCollection>('crosswalks.geojson', { baseDir: datasetDir }),
    loadGeoJson<FeatureCollection>('sign_overrides.geojson', {
      baseDir: datasetDir,
    }).catch(() => ({ type: 'FeatureCollection', features: [] })),
    loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
      'candidates_inferred.geojson',
      { baseDir: datasetDir },
    ).catch(() => ({ type: 'FeatureCollection', features: [] })),
    loadGeoJson<DatasetMeta>('dataset_meta.json', { baseDir: datasetDir }),
  ])
  const loadMs = performance.now() - loadStart

  const segmentStart = performance.now()
  const segments = buildBenchmarkSegments({
    redYellow,
    parkingSpaces,
    signOverrides,
    inferredCandidates,
    meta,
  })
  const segmentMs = performance.now() - segmentStart

  const zoneStart = performance.now()
  const zones: Zone[] = makeZonesFromPOIs(
    busStops,
    hydrants,
    intersections,
    crosswalks,
  )
  const zoneMs = performance.now() - zoneStart

  const indexStart = performance.now()
  const zoneIndex = getZoneIndex(zones, meta?.datasetHash ?? 'local', ZONE_PARAMS_VERSION)
  const indexMs = performance.now() - indexStart

  const evaluateAll = (time: string) =>
    segments.flatMap((segment: Segment) =>
      evaluateSegmentWithZones(segment, time, zoneIndex),
    )

  resetClipCacheStats()
  const evalStart = performance.now()
  const evaluatedFirst = evaluateAll(hhmm)
  const evalMs = performance.now() - evalStart
  const statsAfterFirst = getClipCacheStats()

  const evalSecondStart = performance.now()
  const evaluatedSecond = evaluateAll(hhmm)
  const evalSecondMs = performance.now() - evalSecondStart
  const statsAfterSecond = getClipCacheStats()

  const deltaHits = statsAfterSecond.hits - statsAfterFirst.hits
  const deltaMisses = statsAfterSecond.misses - statsAfterFirst.misses
  const secondPassHitRate =
    deltaHits + deltaMisses > 0 ? deltaHits / (deltaHits + deltaMisses) : null

  const reasonCodeCounts: Record<string, number> = {}
  const reasonCodeByTier: Record<string, Record<string, number>> = {
    GREEN: {},
    YELLOW: {},
    RED: {},
  }
  let withCodes = 0
  evaluatedFirst.forEach((segment) => {
    const codes = segment.reasonCodes ?? []
    if (codes.length > 0) {
      withCodes += 1
    }
    codes.forEach((code) => {
      reasonCodeCounts[code] = (reasonCodeCounts[code] ?? 0) + 1
      const tierBucket = reasonCodeByTier[segment.tier] ?? {}
      tierBucket[code] = (tierBucket[code] ?? 0) + 1
      reasonCodeByTier[segment.tier] = tierBucket
    })
  })
  const coveragePct =
    evaluatedFirst.length > 0 ? (withCodes / evaluatedFirst.length) * 100 : 0

  return {
    datasetHash: meta?.datasetHash ?? 'local',
    hhmm,
    counts: {
      segments: segments.length,
      zones: zones.length,
      evaluatedFirst: evaluatedFirst.length,
      evaluatedSecond: evaluatedSecond.length,
    },
    distribution: computeDistribution(evaluatedFirst),
    reasonCodes: {
      coveragePct,
      counts: reasonCodeCounts,
      byTier: reasonCodeByTier,
    },
    timingsMs: {
      load: Math.round(loadMs),
      buildSegments: Math.round(segmentMs),
      buildZones: Math.round(zoneMs),
      zoneIndex: Math.round(indexMs),
      evalFirst: Math.round(evalMs),
      evalSecond: Math.round(evalSecondMs),
    },
    cache: {
      hits: statsAfterSecond.hits,
      misses: statsAfterSecond.misses,
      size: statsAfterSecond.size,
      maxEntries: statsAfterSecond.maxEntries,
      secondPassHitRate,
    },
  }
}

const main = async () => {
  const hhmm = getArgValue('--hhmm') ?? '13:00'
  const datasetDir =
    getArgValue('--datasetDir') ?? process.env.DATASET_DIR ?? 'tests/fixtures/xinyi'

  const report = await runBenchmark(datasetDir, hhmm)
  console.log(JSON.stringify(report, null, 2))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
