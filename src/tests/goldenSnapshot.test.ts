import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import type { FeatureCollection, LineString, MultiLineString, Point } from 'geojson'
import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
  type DatasetMeta,
} from '../data/segmentBuilder'
import { getDatasetBaseDir } from '../data/datasetResolver'
import { loadGeoJson } from '../data/loaders/loadGeoJson.node'
import { evaluateSegmentWithZones } from '../domain/rules/evaluateSegment'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from '../domain/zones/makeZones'
import { getZoneIndex } from '../domain/zones/zoneIndex'
import type { EvaluatedSegment } from '../ui/types'

const SNAPSHOT_DIR = resolve(process.cwd(), 'tests/snapshots')

const readJson = async <T>(path: string): Promise<T> => {
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as T
}

const computeDistribution = (segments: EvaluatedSegment[]) => {
  const distribution: Record<string, number> = {}
  for (const segment of segments) {
    const key = `${segment.tier}|${segment.allowedNow}`
    distribution[key] = (distribution[key] ?? 0) + 1
  }
  return distribution
}

const computeChecksum = (segments: EvaluatedSegment[], sampleSize: number) => {
  const sample = [...segments]
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .slice(0, sampleSize)
    .map((segment) => ({
      id: segment.id,
      tier: segment.tier,
      allowedNow: segment.allowedNow,
      finalConfidence: segment.finalConfidence,
      reasons: [...segment.reasons].sort(),
      path: segment.path.map((coord) => coord.map((value) => Number(value.toFixed(6)))),
    }))

  const hash = createHash('sha256')
    .update(JSON.stringify(sample))
    .digest('hex')

  return { hash, sampleIds: sample.map((item) => item.id) }
}

describe('golden snapshot regression', () => {
  it('matches tier distribution + checksum', async () => {
    const baseDir = getDatasetBaseDir()
    const requiredFiles = [
      resolve(baseDir, 'red_yellow.geojson'),
      resolve(baseDir, 'bus_stops.geojson'),
      resolve(baseDir, 'hydrants.geojson'),
      resolve(baseDir, 'intersections.geojson'),
      resolve(baseDir, 'crosswalks.geojson'),
      resolve(baseDir, 'sign_overrides.geojson'),
      resolve(baseDir, 'candidates_inferred.geojson'),
      resolve(baseDir, 'dataset_meta.json'),
    ]

    for (const path of requiredFiles) {
      if (!existsSync(path)) {
        throw new Error(
          `Missing dataset output at ${path}. Run npm run ingest before tests.`,
        )
      }
    }

    const [
      redYellow,
      busStops,
      hydrants,
      intersections,
      crosswalks,
      signOverrides,
      inferredCandidates,
      meta,
    ] = await Promise.all([
      loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
        'red_yellow.geojson',
        { baseDir },
      ),
      loadGeoJson<FeatureCollection<Point>>('bus_stops.geojson', { baseDir }),
      loadGeoJson<FeatureCollection<Point>>('hydrants.geojson', { baseDir }),
      loadGeoJson<FeatureCollection<Point>>('intersections.geojson', { baseDir }),
      loadGeoJson<FeatureCollection>('crosswalks.geojson', { baseDir }),
      loadGeoJson<FeatureCollection>('sign_overrides.geojson', { baseDir }),
      loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
        'candidates_inferred.geojson',
        { baseDir },
      ),
      loadGeoJson<DatasetMeta>('dataset_meta.json', { baseDir }),
    ])

    const hhmm = '13:00'
    const datasetHash = meta?.datasetHash ?? 'local'

    const baseSegments = redYellow.features.flatMap((feature, index) =>
      buildSegmentsFromFeature(feature, index, meta),
    )
    const inferredSegments = inferredCandidates.features.flatMap((feature, index) =>
      buildInferredSegmentsFromFeature(feature, index, meta),
    )
    const matchTolerance = meta?.signOverrideMatchToleranceMeters ?? 15
    const segments = applySignOverrides(
      [...baseSegments, ...inferredSegments],
      signOverrides,
      {
        matchToleranceMeters: matchTolerance,
      },
    )

    const zones = makeZonesFromPOIs(busStops, hydrants, intersections, crosswalks)
    const zoneIndex = getZoneIndex(zones, datasetHash, ZONE_PARAMS_VERSION)
    const evaluated = segments.flatMap((segment) =>
      evaluateSegmentWithZones(segment, hhmm, zoneIndex),
    )

    const sortedEvaluated = [...evaluated].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    )
    const distribution = computeDistribution(sortedEvaluated)
    const { hash, sampleIds } = computeChecksum(sortedEvaluated, 25)

    const snapshotPath = resolve(
      SNAPSHOT_DIR,
      `${datasetHash}-${hhmm.replace(':', '')}.json`,
    )

    const snapshotPayload = {
      datasetHash,
      hhmm,
      distribution,
      checksum: hash,
      sampleIds,
    }

    const updateSnapshots = process.env.UPDATE_SNAPSHOTS === '1'
    if (updateSnapshots) {
      await mkdir(SNAPSHOT_DIR, { recursive: true })
      await writeFile(snapshotPath, `${JSON.stringify(snapshotPayload, null, 2)}\n`)
      return
    }

    if (!existsSync(snapshotPath)) {
      throw new Error(
        `Missing snapshot at ${snapshotPath}. Run \`npm run test:update-snapshots\`.`,
      )
    }

    const snapshot = await readJson<typeof snapshotPayload>(snapshotPath)

    expect(snapshot).toEqual(snapshotPayload)
  })
})
