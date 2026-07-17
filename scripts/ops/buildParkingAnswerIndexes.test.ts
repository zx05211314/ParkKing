import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { buildParkingAnswerIndexes } from './buildParkingAnswerIndexes'

describe('buildParkingAnswerIndexes', () => {
  it('is part of the standard build so existing Render commands cannot skip it', async () => {
    const packageJson = JSON.parse(
      await fs.readFile('package.json', 'utf-8'),
    ) as { scripts?: Record<string, string> }

    expect(packageJson.scripts?.build).toContain(
      'npm run ops:build-parking-answer-indexes',
    )
  })

  it('rebuilds indexes after CI fixture ingest before production-mode smoke', async () => {
    const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf-8')
    const ingestPosition = workflow.indexOf('name: Ingest CI fixtures')
    const indexPosition = workflow.indexOf(
      'name: Build parking answer indexes for CI fixtures',
    )
    const smokePosition = workflow.indexOf('name: Smoke API service probes')

    expect(ingestPosition).toBeGreaterThanOrEqual(0)
    expect(indexPosition).toBeGreaterThan(ingestPosition)
    expect(smokePosition).toBeGreaterThan(indexPosition)
  })

  it('writes one prepared index per registry district', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'parking-answer-index-'))
    const dataRoot = path.join(base, 'data')
    const indexRoot = path.join(base, 'indexes')
    await fs.mkdir(dataRoot, { recursive: true })
    await fs.writeFile(
      path.join(dataRoot, 'registry.json'),
      JSON.stringify({
        districts: [{ districtId: 'xinyi' }, { districtId: 'daan' }],
      }),
      'utf-8',
    )
    const loadSource = vi.fn(async (datasetDir: string) => {
      const districtId = path.basename(datasetDir)
      return {
        schemaVersion: 1 as const,
        districtId,
        datasetHash: `hash-${districtId}`,
        zoneParamsVersion: 'zones-v1',
        segments: [],
        zones: [],
        reviewedSignOverridesCount: 1,
        appliedSignOverridesCount: 1,
      }
    })

    const result = await buildParkingAnswerIndexes({
      dataRoot,
      indexRoot,
      loadSource,
    })

    expect(result.results.map((entry) => entry.districtId)).toEqual([
      'daan',
      'xinyi',
    ])
    expect(loadSource).toHaveBeenCalledTimes(2)
    await expect(
      fs.readFile(path.join(indexRoot, 'xinyi.json'), 'utf-8'),
    ).resolves.toContain('"datasetHash":"hash-xinyi"')
  })

  it('can skip a missing production registry in source-only CI builds', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'parking-answer-index-'))
    const dataRoot = path.join(base, 'missing-data')
    const indexRoot = path.join(base, 'indexes')

    const result = await buildParkingAnswerIndexes({
      dataRoot,
      indexRoot,
      allowMissingRegistry: true,
    })

    expect(result).toMatchObject({
      skipped: true,
      results: [],
    })
    await expect(fs.access(indexRoot)).rejects.toThrow()
  })
})
