import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { featureCollection, point } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import {
  readDatasetMetaCounts,
  resolveDatasetMetaPaths,
} from './ingestDatasetMetaFiles'

describe('ingestDatasetMetaFiles', () => {
  it('resolves generated dataset meta paths', () => {
    const paths = resolveDatasetMetaPaths(path.resolve('generated'), 'xinyi')

    expect(paths.boundary).toMatch(/generated[\\/]xinyi_boundary\.geojson$/)
    expect(paths.inferredCandidates).toMatch(
      /generated[\\/]candidates_inferred\.geojson$/,
    )
  })

  it('reads dataset meta counts with missing files treated as zero', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'dataset-meta-files-'))
    const generatedDir = path.join(baseDir, 'generated')
    await fs.mkdir(generatedDir, { recursive: true })

    await fs.writeFile(
      path.join(generatedDir, 'red_yellow.geojson'),
      JSON.stringify(featureCollection([point([121.5, 25.0]), point([121.6, 25.1])])),
      'utf-8',
    )
    await fs.writeFile(
      path.join(generatedDir, 'hydrants.geojson'),
      JSON.stringify(featureCollection([point([121.7, 25.2])])),
      'utf-8',
    )

    const counts = await readDatasetMetaCounts(
      resolveDatasetMetaPaths(generatedDir, 'xinyi'),
    )

    expect(counts.segments).toBe(2)
    expect(counts.hydrants).toBe(1)
    expect(counts.busStops).toBe(0)
    expect(counts.inferredCandidates).toBe(0)
  })
})
