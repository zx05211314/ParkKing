import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { validateOutputDatasets } from './validateOutputDatasets'
import { resolveValidateOutputPaths } from './validateOutputPaths'

const writeFeatureCollection = async (filePath: string, geometry: object) => {
  await fs.writeFile(
    filePath,
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry,
        },
      ],
    }),
    'utf-8',
  )
}

describe('validateOutputDatasets', () => {
  it('validates required generated collections and returns the boundary bbox', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'validate-output-datasets-'))
    const generatedDir = path.join(base, 'generated')
    await fs.mkdir(generatedDir, { recursive: true })

    const polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [121.5, 25],
          [121.6, 25],
          [121.6, 25.1],
          [121.5, 25.1],
          [121.5, 25],
        ],
      ],
    }
    const line = {
      type: 'LineString',
      coordinates: [
        [121.51, 25.01],
        [121.59, 25.09],
      ],
    }
    const point = {
      type: 'Point',
      coordinates: [121.55, 25.05],
    }

    await writeFeatureCollection(path.join(generatedDir, 'xinyi_boundary.geojson'), polygon)
    await writeFeatureCollection(path.join(generatedDir, 'red_yellow.geojson'), line)
    await writeFeatureCollection(path.join(generatedDir, 'bus_stops.geojson'), point)
    await writeFeatureCollection(path.join(generatedDir, 'hydrants.geojson'), point)
    await writeFeatureCollection(path.join(generatedDir, 'parking_spaces.geojson'), point)
    await writeFeatureCollection(path.join(generatedDir, 'intersections.geojson'), point)
    await writeFeatureCollection(path.join(generatedDir, 'crosswalks.geojson'), line)
    await writeFeatureCollection(path.join(generatedDir, 'sign_overrides.geojson'), point)
    await writeFeatureCollection(path.join(generatedDir, 'overrides_applied.geojson'), point)
    await writeFeatureCollection(path.join(generatedDir, 'candidates_inferred.geojson'), line)

    const config = {
      districtId: 'xinyi',
      outputs: {
        generatedDir,
      },
      validation: {
        minCounts: {
          districtBounds: 1,
          redYellow: 1,
          busStops: 1,
          hydrants: 1,
          parkingSpaces: 1,
          intersections: 1,
          crosswalks: 1,
          signOverrides: 1,
          overridesApplied: 1,
          inferredCandidates: 1,
        },
      },
    } as const

    const errors: string[] = []
    const result = await validateOutputDatasets({
      config: config as never,
      paths: resolveValidateOutputPaths(config as never),
      errors,
    })

    expect(errors).toEqual([])
    expect(result.boundaryBBox).toEqual({
      minX: 121.5,
      minY: 25,
      maxX: 121.6,
      maxY: 25.1,
    })

    await writeFeatureCollection(
      path.join(generatedDir, 'candidates_inferred.geojson'),
      {
        type: 'LineString',
        coordinates: [
          [121.59, 25.05],
          [121.63, 25.05],
        ],
      },
    )
    const ownershipErrors: string[] = []
    await validateOutputDatasets({
      config: config as never,
      paths: resolveValidateOutputPaths(config as never),
      errors: ownershipErrors,
    })
    expect(ownershipErrors).toContain(
      '[candidates_inferred] 1 feature(s) have representative centers outside district boundary. Sample IDs: feature-1. Re-run inferred candidate ingest.',
    )
  })
})
