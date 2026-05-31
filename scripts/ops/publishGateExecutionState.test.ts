import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { loadPublishGateExecutionState } from './publishGateExecutionState'

const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const writeDatasetFixture = async (baseDir: string, districtId: string) => {
  const dir = path.join(baseDir, districtId)
  await fs.mkdir(dir, { recursive: true })

  const files = [
    'red_yellow.geojson',
    'bus_stops.geojson',
    'hydrants.geojson',
    'intersections.geojson',
    'intersections_report.json',
    'crosswalks.geojson',
    'sign_overrides.geojson',
    'candidates_inferred.geojson',
    'overrides_applied.geojson',
  ]

  const fileHashes: Record<string, { sha256: string; bytes: number }> = {}
  let totalBytes = 0

  for (const fileName of files) {
    const payload =
      fileName === 'overrides_applied.geojson'
        ? JSON.stringify({ type: 'FeatureCollection', features: [] })
        : JSON.stringify({ name: fileName })
    await fs.writeFile(path.join(dir, fileName), payload, 'utf-8')
    const buffer = Buffer.from(payload)
    fileHashes[fileName] = { sha256: hashBuffer(buffer), bytes: buffer.length }
    totalBytes += buffer.length
  }

  await fs.writeFile(
    path.join(dir, 'dataset_meta.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        metricsSchemaVersion: 1,
        districtId,
        districtName: 'Test District',
        generatedAt: new Date().toISOString(),
        datasetHash: 'fixture-hash',
        publishMode: 'atomic',
        publishedAt: new Date().toISOString(),
        signOverrideMatchToleranceMeters: 15,
        counts: {
          segments: 1,
          busStops: 1,
          hydrants: 1,
          zones: 1,
          intersections: 1,
          crosswalks: 1,
          signOverrides: 0,
          inferredCandidates: 0,
          overridesApplied: 0,
        },
        segmentsCount: 1,
        signOverridesCount: 0,
        overridesAppliedCount: 0,
        curbMarkingKnownRate: 1,
        restrictionTriggeredRate: 0.5,
        boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        boundaryCenter: [0.5, 0.5],
        files: fileHashes,
        totalBytes,
      },
      null,
      2,
    ),
    'utf-8',
  )
}

describe('publishGateExecutionState', () => {
  it('loads runtime, district summaries, totals, and exit code before artifact writes', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-execution-state-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = path.join(base, 'ingest_all_report.json')
    await fs.writeFile(
      reportPath,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        districts: [{ districtId: 'xinyi', warnings: [] }],
      }),
      'utf-8',
    )

    const state = await loadPublishGateExecutionState({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(state.exitCode).toBe(0)
    expect(state.districtSummaries).toHaveLength(1)
    expect(state.districtSummaries[0]).toMatchObject({
      districtId: 'xinyi',
      info: 0,
      warn: 0,
      fail: 0,
    })
    expect(state.totals).toEqual({
      info: 0,
      warn: 0,
      fail: 0,
    })
    expect(state.runtime.reportPath).toBe(reportPath)
  })
})
