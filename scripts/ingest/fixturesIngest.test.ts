import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { readConfig } from './readConfig'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import { ingestRedYellow } from './ingestRedYellow'
import { ingestBusStops } from './ingestBusStops'
import { ingestHydrants } from './ingestHydrants'
import { ingestCrosswalks } from './ingestCrosswalks'
import { ingestIntersections } from './ingestIntersections'
import { ingestSignOverrides } from './ingestSignOverrides'
import { ingestInferredCandidates } from './ingestInferredCandidates'
import { buildDatasetMeta, writeJson } from './utils'
import { validateOutputs } from './validateOutputs'

describe('fixture passthrough ingest', () => {
  it('ingests fixtures and validates outputs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-fixtures-'))
    const generatedDir = path.join(base, 'generated')
    const publicDir = path.join(base, 'public')

    const config = {
      districtId: 'xinyi',
      districtName: 'Xinyi (CI Fixtures)',
      inputs: {
        districtBounds: path.resolve('tests/fixtures/xinyi/xinyi_boundary.geojson'),
        redYellow: path.resolve('tests/fixtures/xinyi/red_yellow.geojson'),
        busStops: path.resolve('tests/fixtures/xinyi/bus_stops.geojson'),
        hydrants: path.resolve('tests/fixtures/xinyi/hydrants.geojson'),
        intersections: path.resolve('tests/fixtures/xinyi/intersections.geojson'),
        crosswalks: path.resolve('tests/fixtures/xinyi/crosswalks.geojson'),
        sign_overrides: path.resolve('tests/fixtures/xinyi/sign_overrides.geojson'),
        candidates_inferred: path.resolve('tests/fixtures/xinyi/candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir,
        publicDir,
      },
      crs: {
        default: 'EPSG:4326',
      },
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

    const configPath = path.join(base, 'config.json')
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    const resolved = await readConfig(['node', 'test', '--config', configPath])

    await ingestDistrictBounds(resolved)
    await ingestRedYellow(resolved)
    await ingestBusStops(resolved)
    await ingestHydrants(resolved)
    await ingestCrosswalks(resolved)
    await ingestIntersections(resolved)
    await ingestSignOverrides(resolved)
    await ingestInferredCandidates(resolved)

    const meta = await buildDatasetMeta(resolved)
    await writeJson(resolved, 'dataset_meta.json', meta)

    await validateOutputs(resolved)

    const outputMeta = await fs.readFile(
      path.join(generatedDir, 'dataset_meta.json'),
      'utf-8',
    )
    const parsed = JSON.parse(outputMeta) as Record<string, unknown>
    expect(parsed.districtId).toBe('xinyi')
    expect(parsed.metricsSchemaVersion).toBe(1)
    expect(parsed.segmentsCount).toBe(4)
    expect(parsed.signOverridesCount).toBe(3)
    expect(parsed.overridesAppliedCount).toBe(0)
    expect(parsed.curbMarkingKnownRate).toBeCloseTo(1, 5)
    expect(parsed.restrictionTriggeredRate).toBeCloseTo(1, 5)
  })
})
