import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import { ingestSignOverrides } from './ingestSignOverrides'
import { readConfig } from './readConfig'
import { applySignOverrides } from '../../src/data/segmentBuilder'

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const pickBoundaryPoint = (boundary: FeatureCollection): [number, number] => {
  const feature = boundary.features[0] as { geometry?: Polygon | MultiPolygon }
  if (!feature?.geometry) {
    return [0, 0]
  }
  if (feature.geometry.type === 'Polygon') {
    return feature.geometry.coordinates[0]?.[0] ?? [0, 0]
  }
  return feature.geometry.coordinates[0]?.[0]?.[0] ?? [0, 0]
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

      const segments = [
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
})
