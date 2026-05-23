import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { featureCollection, point } from '@turf/turf'
import { afterEach, describe, expect, it } from 'vitest'
import type { ResolvedConfig } from './readConfig'
import {
  readGeoJsonCollection,
  readGeoJsonFeatureCount,
  readIntersectionsReport,
  readProvenanceFetchedAt,
  resolveSignOverridesFreshness,
} from './ingestDatasetMetaReaders'

const originalCwd = process.cwd()

afterEach(() => {
  process.chdir(originalCwd)
})

const createConfig = (
  baseDir: string,
  overrides: Partial<ResolvedConfig> = {},
): ResolvedConfig => {
  const generatedDir = path.join(baseDir, 'generated')
  const publicDir = path.join(baseDir, 'public')

  return {
    districtId: 'xinyi',
    districtName: 'Xinyi',
    boundary: { names: ['Xinyi'] },
    configPath: path.join(baseDir, 'config.json'),
    configHash: 'config-hash',
    datasetHash: 'dataset-hash',
    inputs: {
      districtBounds: path.join(baseDir, 'boundary.geojson'),
      redYellow: path.join(baseDir, 'red_yellow.geojson'),
      busStops: path.join(baseDir, 'bus_stops.geojson'),
      hydrants: path.join(baseDir, 'hydrants.geojson'),
      intersections: path.join(baseDir, 'intersections.geojson'),
      crosswalks: path.join(baseDir, 'crosswalks.geojson'),
      sign_overrides: path.join(baseDir, 'sign_overrides.geojson'),
      candidates_inferred: path.join(baseDir, 'candidates_inferred.geojson'),
      parking_spaces: path.join(baseDir, 'parking_spaces.geojson'),
      road_centerlines: path.join(baseDir, 'road_centerlines.geojson'),
    },
    outputs: {
      generatedDir,
      publicDir,
    },
    crs: {
      default: 'EPSG:4326',
    },
    intersections: {
      snapToleranceMeters: 10,
      angleDiversityDegrees: 15,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    crosswalks: {
      bufferMeters: 5,
    },
    signOverrides: {
      matchToleranceMeters: 6,
    },
    inferredCandidates: {
      offsetMeters: 2,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    ops: {
      thresholds: {
        counts: {
          segments: 0,
          intersections: 0,
          inferredCandidates: 0,
          signOverrides: 0,
        },
        tierDistributionMaxDeltaPct: 0,
        perfRegressionMaxDeltaPct: 0,
        maxReasonCodeDeltaPct: 0,
        maxNewReasonCodePct: 0,
      },
      retention: {
        maxBackupsPerDistrict: 5,
        maxBackupAgeDays: 30,
      },
    },
    validation: {
      minCounts: {
        districtBounds: 1,
        redYellow: 1,
        busStops: 1,
        hydrants: 1,
        parkingSpaces: 0,
        intersections: 1,
        crosswalks: 0,
        signOverrides: 0,
        overridesApplied: 0,
        inferredCandidates: 0,
      },
    },
    sourceFiles: [],
    ...overrides,
  }
}

describe('ingestDatasetMetaReaders', () => {
  it('reads geojson collections and missing counts safely', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-meta-readers-'))
    const filePath = path.join(base, 'sample.geojson')
    const collection = featureCollection([point([121.5, 25.0])])
    await fs.writeFile(filePath, JSON.stringify(collection), 'utf-8')

    expect(await readGeoJsonFeatureCount(filePath)).toBe(1)
    expect(await readGeoJsonFeatureCount(path.join(base, 'missing.geojson'))).toBe(0)
    expect(await readGeoJsonCollection(filePath)).toEqual(collection)
    expect(await readGeoJsonCollection(path.join(base, 'missing.geojson'))).toBeNull()
  })

  it('prefers generated provenance and resolves sign override freshness', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-meta-provenance-'))
    process.chdir(base)
    const generatedDir = path.join(base, 'generated')
    const sourceDir = path.join(base, 'data', 'sources', 'xinyi')
    await fs.mkdir(generatedDir, { recursive: true })
    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(
      path.join(generatedDir, 'provenance.json'),
      JSON.stringify({ fetchedAt: '2026-03-01T00:00:00.000Z' }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(sourceDir, 'provenance.json'),
      JSON.stringify({ fetchedAt: '2025-01-01T00:00:00.000Z' }),
      'utf-8',
    )

    const signOverridePath = path.join(base, 'sign_overrides.geojson')
    const config = createConfig(base, {
      sourceFiles: [{ path: signOverridePath, mtimeMs: Date.now() - 86_400_000 }],
    })

    expect(await readProvenanceFetchedAt(config)).toBe('2026-03-01T00:00:00.000Z')
    expect(await readIntersectionsReport(generatedDir)).toBeNull()

    const freshness = resolveSignOverridesFreshness(config)
    expect(freshness.signOverridesUpdatedAt).toMatch(/^20/)
    expect(freshness.signOverridesFreshnessDays).toBeGreaterThanOrEqual(1)
  })

  it('uses user override JSONL as a sign override freshness source', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-meta-overrides-'))
    process.chdir(base)
    const overrideReportsPath = path.join(base, 'data', 'overrides', 'xinyi.jsonl')
    await fs.mkdir(path.dirname(overrideReportsPath), { recursive: true })
    await fs.writeFile(overrideReportsPath, '{}\n', 'utf-8')
    const mtimeMs = Date.now() - 172_800_000
    const baseConfig = createConfig(base)
    const config = createConfig(base, {
      inputs: {
        ...baseConfig.inputs,
        sign_overrides: undefined,
      },
      sourceFiles: [
        {
          path: overrideReportsPath,
          mtimeMs,
          size: 3,
        },
      ],
    })

    const freshness = resolveSignOverridesFreshness(config)
    expect(freshness.signOverridesUpdatedAt).toBe(new Date(mtimeMs).toISOString())
    expect(freshness.signOverridesFreshnessDays).toBeGreaterThanOrEqual(2)
  })
})
