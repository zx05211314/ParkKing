import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import type { FeatureCollection, Position, Polygon, MultiPolygon } from 'geojson'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import { ingestSignOverrides } from './ingestSignOverrides'
import { readConfig } from './readConfig'
import { applySignOverrides } from '../../src/data/segmentBuilder'
import type { Segment } from '../../src/ui/types'

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const toLngLat = (position: Position | undefined): [number, number] =>
  typeof position?.[0] === 'number' && typeof position[1] === 'number'
    ? [position[0], position[1]]
    : [0, 0]

const pickBoundaryPoint = (boundary: FeatureCollection): [number, number] => {
  const feature = boundary.features[0] as { geometry?: Polygon | MultiPolygon }
  if (!feature?.geometry) {
    return [0, 0]
  }
  if (feature.geometry.type === 'Polygon') {
    return toLngLat(feature.geometry.coordinates[0]?.[0])
  }
  return toLngLat(feature.geometry.coordinates[0]?.[0]?.[0])
}

describe('ingestSignOverrides overrides merge', () => {
  it('prefers user overrides with higher confidence', async () => {
    const repoRoot = process.cwd()
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-overrides-'))
    const generatedDir = path.join(base, 'generated')
    const publicDir = path.join(base, 'public')

    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
    const boundaryFixture = path.join(fixturesDir, 'xinyi_boundary.geojson')

    const boundaryCollection = await readJson<FeatureCollection>(boundaryFixture)
    const boundaryPoint = pickBoundaryPoint(boundaryCollection)

    const signOverridesPath = path.join(base, 'sign_overrides.geojson')
    const signOverrides = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: boundaryPoint },
          properties: {
            segmentId: 'seg-1',
            override_note: 'Legacy override',
            override_confidence: 'HIGH',
            override_verified_at: '2027-01-01T00:00:00Z',
          },
        },
      ],
    }
    await fs.writeFile(signOverridesPath, JSON.stringify(signOverrides), 'utf-8')

    const overridesDir = path.join(base, 'data', 'overrides')
    await fs.mkdir(overridesDir, { recursive: true })
    const overridesPath = path.join(overridesDir, 'xinyi.jsonl')
    const overrideLine = JSON.stringify({
      schemaVersion: 1,
      districtId: 'xinyi',
      segmentId: 'seg-1-part-1',
      status: 'LEGAL',
      note: 'User says ok',
      createdAt: '2026-02-01T00:00:00Z',
    })
    await fs.writeFile(overridesPath, `${overrideLine}\n`, 'utf-8')

    const configPath = path.join(base, 'config.json')
    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: boundaryFixture,
        redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
        busStops: path.join(fixturesDir, 'bus_stops.geojson'),
        hydrants: path.join(fixturesDir, 'hydrants.geojson'),
        intersections: path.join(fixturesDir, 'intersections.geojson'),
        crosswalks: path.join(fixturesDir, 'crosswalks.geojson'),
        sign_overrides: signOverridesPath,
        candidates_inferred: path.join(fixturesDir, 'candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir,
      },
      crs: { default: 'EPSG:4326' },
      validation: {
        minCounts: {
          districtBounds: 1,
          redYellow: 1,
          busStops: 1,
          hydrants: 1,
          intersections: 1,
          crosswalks: 1,
          signOverrides: 1,
          inferredCandidates: 1,
        },
      },
    }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    const originalCwd = process.cwd()
    process.chdir(base)
    try {
      const resolved = await readConfig(['node', 'test', '--config', configPath])
      await ingestDistrictBounds(resolved)
      await ingestSignOverrides(resolved)

      const overridesOutput = await readJson<FeatureCollection>(
        path.join(generatedDir, 'sign_overrides.geojson'),
      )

      const segments: Segment[] = [
        {
          id: 'seg-1',
          name: 'Segment 1',
          curbMarking: 'RED',
          confidence: 'HIGH',
          path: [
            [0, 0],
            [1, 1],
          ],
        },
      ]

      const applied = applySignOverrides(segments, overridesOutput, {
        matchToleranceMeters: 5,
      })

      expect(applied[0]?.signOverride?.note).toContain('User report: LEGAL')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('places user override geometry on the named segment when red-yellow output exists', async () => {
    const repoRoot = process.cwd()
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-overrides-geometry-'))
    const generatedDir = path.join(base, 'generated')
    const publicDir = path.join(base, 'public')
    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
    const boundaryFixture = path.join(fixturesDir, 'xinyi_boundary.geojson')

    const overridesDir = path.join(base, 'data', 'overrides')
    await fs.mkdir(overridesDir, { recursive: true })
    await fs.writeFile(
      path.join(overridesDir, 'xinyi.jsonl'),
      `${JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1-part-1',
        status: 'LEGAL',
        note: 'field checked',
        createdAt: '2026-02-01T00:00:00Z',
      })}\n`,
      'utf-8',
    )

    const configPath = path.join(base, 'config.json')
    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: boundaryFixture,
        redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
        busStops: path.join(fixturesDir, 'bus_stops.geojson'),
        hydrants: path.join(fixturesDir, 'hydrants.geojson'),
        intersections: path.join(fixturesDir, 'intersections.geojson'),
        crosswalks: path.join(fixturesDir, 'crosswalks.geojson'),
        candidates_inferred: path.join(fixturesDir, 'candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir,
      },
      crs: { default: 'EPSG:4326' },
    }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    const originalCwd = process.cwd()
    process.chdir(base)
    try {
      const resolved = await readConfig(['node', 'test', '--config', configPath])
      await ingestDistrictBounds(resolved)
      await fs.writeFile(
        path.join(generatedDir, 'red_yellow.geojson'),
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [121.5, 25],
                  [121.502, 25.002],
                ],
              },
              properties: {},
            },
          ],
        }),
        'utf-8',
      )
      await ingestSignOverrides(resolved)

      const applied = await readJson<FeatureCollection>(
        path.join(generatedDir, 'overrides_applied.geojson'),
      )
      const coordinates = applied.features[0]?.geometry?.type === 'Point'
        ? applied.features[0].geometry.coordinates
        : null

      expect(coordinates?.[0]).toBeCloseTo(121.501)
      expect(coordinates?.[1]).toBeCloseTo(25.001)
      expect(applied.features[0]?.properties?.segmentId).toBe('seg-1')
      expect(applied.features[0]?.properties?.override_geometry_source).toBe(
        'SEGMENT_GEOMETRY',
      )
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('places user override geometry on named inferred candidates when generated output exists', async () => {
    const repoRoot = process.cwd()
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-overrides-inferred-geometry-'))
    const generatedDir = path.join(base, 'generated')
    const publicDir = path.join(base, 'public')
    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
    const boundaryFixture = path.join(fixturesDir, 'xinyi_boundary.geojson')

    const overridesDir = path.join(base, 'data', 'overrides')
    await fs.mkdir(overridesDir, { recursive: true })
    await fs.writeFile(
      path.join(overridesDir, 'xinyi.jsonl'),
      `${JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'candidate-1-L-part-3',
        status: 'LEGAL',
        note: 'field checked inferred candidate',
        createdAt: '2026-02-01T00:00:00Z',
      })}\n`,
      'utf-8',
    )

    const configPath = path.join(base, 'config.json')
    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: boundaryFixture,
        redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
        busStops: path.join(fixturesDir, 'bus_stops.geojson'),
        hydrants: path.join(fixturesDir, 'hydrants.geojson'),
        intersections: path.join(fixturesDir, 'intersections.geojson'),
        crosswalks: path.join(fixturesDir, 'crosswalks.geojson'),
        candidates_inferred: path.join(fixturesDir, 'candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir,
      },
      crs: { default: 'EPSG:4326' },
    }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    const originalCwd = process.cwd()
    process.chdir(base)
    try {
      const resolved = await readConfig(['node', 'test', '--config', configPath])
      await ingestDistrictBounds(resolved)
      await fs.writeFile(
        path.join(generatedDir, 'red_yellow.geojson'),
        JSON.stringify({ type: 'FeatureCollection', features: [] }),
        'utf-8',
      )
      await fs.writeFile(
        path.join(generatedDir, 'candidates_inferred.geojson'),
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { id: 'candidate-1-L' },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [121.6, 25.1],
                  [121.602, 25.102],
                ],
              },
            },
          ],
        }),
        'utf-8',
      )
      await ingestSignOverrides(resolved)

      const applied = await readJson<FeatureCollection>(
        path.join(generatedDir, 'overrides_applied.geojson'),
      )
      const coordinates = applied.features[0]?.geometry?.type === 'Point'
        ? applied.features[0].geometry.coordinates
        : null

      expect(coordinates?.[0]).toBeCloseTo(121.601)
      expect(coordinates?.[1]).toBeCloseTo(25.101)
      expect(applied.features[0]?.properties?.segmentId).toBe('candidate-1-L')
      expect(applied.features[0]?.properties?.override_geometry_source).toBe(
        'SEGMENT_GEOMETRY',
      )
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('skips user override reports that are missing evidence note or timestamp', async () => {
    const repoRoot = process.cwd()
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-overrides-evidence-'))
    const generatedDir = path.join(base, 'generated')
    const publicDir = path.join(base, 'public')
    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
    const boundaryFixture = path.join(fixturesDir, 'xinyi_boundary.geojson')

    const overridesDir = path.join(base, 'data', 'overrides')
    await fs.mkdir(overridesDir, { recursive: true })
    await fs.writeFile(
      path.join(overridesDir, 'xinyi.jsonl'),
      [
        JSON.stringify({
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-1',
          status: 'LEGAL',
          note: 'field checked',
          createdAt: '2026-02-01T00:00:00Z',
        }),
        JSON.stringify({
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-2',
          status: 'ILLEGAL',
          createdAt: '2026-02-02T00:00:00Z',
        }),
        JSON.stringify({
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-3',
          status: 'UNCLEAR',
          note: 'missing timestamp',
        }),
      ].join('\n'),
      'utf-8',
    )

    const configPath = path.join(base, 'config.json')
    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: boundaryFixture,
        redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
        busStops: path.join(fixturesDir, 'bus_stops.geojson'),
        hydrants: path.join(fixturesDir, 'hydrants.geojson'),
        intersections: path.join(fixturesDir, 'intersections.geojson'),
        crosswalks: path.join(fixturesDir, 'crosswalks.geojson'),
        candidates_inferred: path.join(fixturesDir, 'candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir,
      },
      crs: { default: 'EPSG:4326' },
    }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    const originalCwd = process.cwd()
    process.chdir(base)
    try {
      const resolved = await readConfig(['node', 'test', '--config', configPath])
      await ingestDistrictBounds(resolved)
      await ingestSignOverrides(resolved)

      const applied = await readJson<FeatureCollection>(
        path.join(generatedDir, 'overrides_applied.geojson'),
      )

      expect(applied.features).toHaveLength(1)
      expect(applied.features[0]?.properties?.segmentId).toBe('seg-1')
      expect(applied.features[0]?.properties?.override_note).toContain('field checked')
      expect(applied.features[0]?.properties?.override_verified_at).toBe(
        '2026-02-01T00:00:00Z',
      )
    } finally {
      process.chdir(originalCwd)
    }
  })
})
