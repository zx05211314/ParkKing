import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import type { FeatureCollection, LineString, MultiLineString } from 'geojson'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import { ingestRedYellow } from './ingestRedYellow'
import { ingestInferredCandidates } from './ingestInferredCandidates'
import { readConfig } from './readConfig'
import {
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
} from '../../src/data/segmentBuilder'

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const collectSegmentIds = async (generatedDir: string) => {
  const redYellow = await readJson<FeatureCollection<LineString | MultiLineString>>(
    path.join(generatedDir, 'red_yellow.geojson'),
  )
  const inferred = await readJson<FeatureCollection<LineString | MultiLineString>>(
    path.join(generatedDir, 'candidates_inferred.geojson'),
  )

  const ids = [
    ...redYellow.features.flatMap((feature, index) =>
      buildSegmentsFromFeature(feature, index, null),
    ),
    ...inferred.features.flatMap((feature, index) =>
      buildInferredSegmentsFromFeature(feature, index, null),
    ),
  ].map((segment) => segment.id)

  return ids.sort()
}

const runIngest = async (base: string, label: string) => {
  const generatedDir = path.join(base, label, 'generated')
  const publicDir = path.join(base, label, 'public')

  const fixturesDir = path.resolve('tests/fixtures/xinyi')
  const config = {
    districtId: 'xinyi',
    districtName: 'Xinyi Stability Test',
    inputs: {
      districtBounds: path.join(fixturesDir, 'xinyi_boundary.geojson'),
      redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
      busStops: path.join(fixturesDir, 'bus_stops.geojson'),
      hydrants: path.join(fixturesDir, 'hydrants.geojson'),
      intersections: path.join(fixturesDir, 'intersections.geojson'),
      crosswalks: path.join(fixturesDir, 'crosswalks.geojson'),
      sign_overrides: path.join(fixturesDir, 'sign_overrides.geojson'),
      candidates_inferred: path.join(fixturesDir, 'candidates_inferred.geojson'),
    },
    outputs: { generatedDir, publicDir },
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

  const configPath = path.join(base, `${label}.json`)
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  const resolved = await readConfig(['node', 'test', '--config', configPath])

  await ingestDistrictBounds(resolved)
  await ingestRedYellow(resolved)
  await ingestInferredCandidates(resolved)

  return generatedDir
}

describe('segment id stability', () => {
  it('keeps segment ids stable across identical ingests', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'segment-id-stability-'))
    const firstDir = await runIngest(base, 'run-a')
    const secondDir = await runIngest(base, 'run-b')

    const firstIds = await collectSegmentIds(firstDir)
    const secondIds = await collectSegmentIds(secondDir)

    expect(firstIds.length).toBeGreaterThan(0)
    expect(secondIds).toEqual(firstIds)
  })
})
