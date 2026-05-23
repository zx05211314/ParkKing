import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { validateDatasetPack } from './publishGateValidation'

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
    const filePath = path.join(dir, fileName)
    await fs.writeFile(filePath, payload, 'utf-8')
    const buffer = Buffer.from(payload)
    fileHashes[fileName] = {
      sha256: hashBuffer(buffer),
      bytes: buffer.length,
    }
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
        signOverrideUnmatchedNamedCount: 0,
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

  return dir
}

describe('validateDatasetPack', () => {
  it('returns a missing district warning for unknown ids', async () => {
    await expect(validateDatasetPack('unknown')).resolves.toEqual([
      expect.objectContaining({
        severity: 'FAIL',
        code: 'DISTRICT_ID_MISSING',
      }),
    ])
  })

  it('returns a pack missing warning when no dataset directory exists', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-validation-'))
    await expect(validateDatasetPack('__missing_publish_gate_validation__', base)).resolves.toEqual([
      expect.objectContaining({
        severity: 'FAIL',
        code: 'PACK_MISSING',
      }),
    ])
  })

  it('surfaces metric warnings directly from dataset metadata', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-validation-'))
    const dir = await writeDatasetFixture(base, 'xinyi')
    const metaPath = path.join(dir, 'dataset_meta.json')
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as Record<string, unknown>
    meta.curbMarkingKnownRate = 0.05
    meta.restrictionTriggeredRate = 0.005
    meta.signOverrideUnmatchedNamedCount = 3
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const warnings = await validateDatasetPack('xinyi', base)
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'METRIC_CURB_MARKING_LOW', severity: 'WARN' }),
        expect.objectContaining({ code: 'METRIC_RESTRICTION_LOW', severity: 'WARN' }),
        expect.objectContaining({
          code: 'METRIC_SIGN_OVERRIDE_UNMATCHED',
          severity: 'WARN',
        }),
      ]),
    )
  })
})
