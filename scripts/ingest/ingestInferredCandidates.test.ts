import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { featureCollection, lineString, polygon } from '@turf/turf'
import type { FeatureCollection } from 'geojson'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import {
  filterCandidatesToBoundaryOwnership,
  ingestInferredCandidates,
} from './ingestInferredCandidates'
import { readConfig } from './readConfig'

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

describe('ingestInferredCandidates', () => {
  it('keeps only intersecting candidates whose center belongs to the district', () => {
    const boundary = polygon([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ])
    const inside = lineString(
      [
        [2, 2],
        [8, 8],
      ],
      { id: 'inside' },
    )
    const crossingFromOutside = lineString(
      [
        [8, 5],
        [14, 5],
      ],
      { id: 'outside-center' },
    )
    const fullyOutside = lineString(
      [
        [12, 2],
        [14, 2],
      ],
      { id: 'outside' },
    )

    const filtered = filterCandidatesToBoundaryOwnership(
      featureCollection([inside, crossingFromOutside, fullyOutside]),
      boundary,
    )

    expect(filtered.features.map((feature) => feature.properties?.id)).toEqual([
      'inside',
    ])
  })

  it('generates inferred candidates from polygon road surfaces', async () => {
    const repoRoot = process.cwd()
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-inferred-'))
    const generatedDir = path.join(base, 'generated')
    const publicDir = path.join(base, 'public')
    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
    const boundaryFixture = path.join(fixturesDir, 'xinyi_boundary.geojson')

    const roadCenterlinesPath = path.join(base, 'road_centerlines.geojson')
    await fs.writeFile(
      roadCenterlinesPath,
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: 'road-1',
              ROADNAME: 'Test Road',
              ROADWIDTH: 18,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [121.5637, 25.0330],
                [121.5644, 25.0330],
                [121.5645, 25.0332],
                [121.5638, 25.0332],
                [121.5637, 25.0330],
              ]],
            },
          },
        ],
      }),
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
        road_centerlines: roadCenterlinesPath,
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
          inferredCandidates: 1,
        },
      },
    }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    const resolved = await readConfig(['node', 'test', '--config', configPath])
    await ingestDistrictBounds(resolved)
    await ingestInferredCandidates(resolved)

    const generated = await readJson<FeatureCollection>(
      path.join(generatedDir, 'candidates_inferred.geojson'),
    )

    expect(generated.features.length).toBeGreaterThan(0)
    expect(generated.features[0]?.geometry?.type).toBe('LineString')
  })
})
