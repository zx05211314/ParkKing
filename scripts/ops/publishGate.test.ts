import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { runPublishGate } from './publishGate'


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
    const bytes = buffer.length
    fileHashes[fileName] = {
      sha256: hashBuffer(buffer),
      bytes,
    }
    totalBytes += bytes
  }

  const meta = {
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
  }

  await fs.writeFile(
    path.join(dir, 'dataset_meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8',
  )

  return dir
}

const writeReport = async (dir: string, payload: unknown) => {
  const reportPath = path.join(dir, 'ingest_all_report.json')
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf-8')
  return reportPath
}

describe('publishGate', () => {
  it('passes with no warnings', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      generatedAt: new Date().toISOString(),
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(0)
  })

  it('fails when required sign override input and applied coverage are zero', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      generatedAt: new Date().toISOString(),
      districts: [
        {
          districtId: 'xinyi',
          validation: {
            minCounts: {
              signOverrides: 1,
              overridesApplied: 1,
            },
          },
          warnings: [],
        },
      ],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(3)
    expect(result.summary.districts?.[0]?.topFailCodes).toEqual(
      expect.arrayContaining([
        'SIGN_OVERRIDE_INPUT_MISSING',
        'SIGN_OVERRIDE_COVERAGE_ZERO',
      ]),
    )
  })

  it('blocks warn when allowWarn is false', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      districts: [
        { districtId: 'xinyi', warnings: [{ severity: 'WARN', code: 'COUNT_DELTA', message: 'warn' }] },
      ],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      allowWarn: false,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(2)
  })

  it('blocks fail when allowFail is false', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      districts: [
        { districtId: 'xinyi', warnings: [{ severity: 'FAIL', code: 'PERF_REGRESSION', message: 'fail' }] },
      ],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      allowFail: false,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(3)
  })

  it('requires override when allowWarn is true', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      districts: [
        { districtId: 'xinyi', warnings: [{ severity: 'WARN', code: 'COUNT_DELTA', message: 'warn' }] },
      ],
    })

    await expect(
      runPublishGate({
        reportPath,
        outputDir: base,
        allowWarn: true,
        datasetRootDir: base,
      }),
    ).rejects.toThrow(/override/i)
  })

  it('allows warn with override', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      districts: [
        { districtId: 'xinyi', warnings: [{ severity: 'WARN', code: 'COUNT_DELTA', message: 'warn' }] },
      ],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      allowWarn: true,
      overrideReason: 'acknowledged',
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(0)
  })

  it('allows bootstrap override when previous pack is missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      districts: [
        {
          districtId: 'xinyi',
          warnings: [{ severity: 'FAIL', code: 'PERF_REGRESSION', message: 'fail' }],
        },
      ],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      allowFail: true,
      overrideReason: 'taipei-real-bootstrap',
      datasetRootDir: base,
      publishedRootDir: path.join(base, 'published'),
    })

    expect(result.exitCode).toBe(0)
    expect(result.summary.allowFail).toBe(true)
    expect(result.summary.bootstrap).toEqual({
      requested: true,
      modeUsed: true,
      denied: false,
      previousPackExists: false,
    })
    expect(result.summary.gateMessageFlags).toEqual([
      'BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH',
    ])
  })

  it('does not allow bootstrap override when previous pack exists', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    await writeDatasetFixture(base, 'xinyi')
    const publishedRoot = path.join(base, 'published')
    await writeDatasetFixture(publishedRoot, 'xinyi')
    const reportPath = await writeReport(base, {
      districts: [
        {
          districtId: 'xinyi',
          warnings: [{ severity: 'FAIL', code: 'PERF_REGRESSION', message: 'fail' }],
        },
      ],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      allowFail: true,
      overrideReason: 'taipei-real-bootstrap',
      datasetRootDir: base,
      publishedRootDir: publishedRoot,
    })

    expect(result.exitCode).toBe(3)
    expect(result.summary.allowFail).toBe(false)
    expect(result.summary.bootstrap).toEqual({
      requested: true,
      modeUsed: false,
      denied: true,
      previousPackExists: true,
    })
    expect(result.summary.gateMessageFlags).toEqual([
      'BOOTSTRAP_DENIED_PREVIOUS_PACK_EXISTS',
    ])
  })

  it('fails when boundaryCenter falls outside bbox', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    const dir = await writeDatasetFixture(base, 'xinyi')
    const metaPath = path.join(dir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    meta.boundaryCenter = [5, 5]
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(base, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(3)
  })

  it('fails when boundaryCenter is missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    const dir = await writeDatasetFixture(base, 'xinyi')
    const metaPath = path.join(dir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    delete meta.boundaryCenter
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(base, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(3)
  })

  it('fails when a required layer file is missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    const dir = await writeDatasetFixture(base, 'xinyi')
    await fs.rm(path.join(dir, 'intersections.geojson'))

    const reportPath = await writeReport(base, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(3)
  })

  it('fails when overrides_applied entries are malformed', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    const dir = await writeDatasetFixture(base, 'xinyi')
    const overridesPath = path.join(dir, 'overrides_applied.geojson')

    const invalidOverrides = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0.5, 0.5] },
          properties: { override_status: 'LEGAL' },
        },
      ],
    }
    const payload = JSON.stringify(invalidOverrides)
    await fs.writeFile(overridesPath, payload, 'utf-8')

    const metaPath = path.join(dir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    const buffer = Buffer.from(payload)
    meta.counts = {
      ...((meta.counts as Record<string, unknown> | undefined) ?? {}),
      overridesApplied: 1,
    }
    meta.files = {
      ...((meta.files as Record<string, unknown> | undefined) ?? {}),
      'overrides_applied.geojson': {
        sha256: hashBuffer(buffer),
        bytes: buffer.length,
      },
    }
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(base, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(3)
  })

  it('fails when overrides_applied schemaVersion is unknown', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    const dir = await writeDatasetFixture(base, 'xinyi')

    const redYellow = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
          properties: { id: 'seg-1' },
        },
      ],
    })
    const inferred = JSON.stringify({ type: 'FeatureCollection', features: [] })
    const overridesPayload = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0.5, 0.5] },
          properties: {
            segmentId: 'seg-1',
            override_status: 'LEGAL',
            override_schema_version: 99,
          },
        },
      ],
    })

    const redYellowPath = path.join(dir, 'red_yellow.geojson')
    const inferredPath = path.join(dir, 'candidates_inferred.geojson')
    const overridesPath = path.join(dir, 'overrides_applied.geojson')

    await fs.writeFile(redYellowPath, redYellow, 'utf-8')
    await fs.writeFile(inferredPath, inferred, 'utf-8')
    await fs.writeFile(overridesPath, overridesPayload, 'utf-8')

    const metaPath = path.join(dir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    meta.counts = {
      ...((meta.counts as Record<string, unknown> | undefined) ?? {}),
      overridesApplied: 1,
    }
    meta.files = {
      ...((meta.files as Record<string, unknown> | undefined) ?? {}),
      'red_yellow.geojson': {
        sha256: hashBuffer(Buffer.from(redYellow)),
        bytes: Buffer.from(redYellow).length,
      },
      'candidates_inferred.geojson': {
        sha256: hashBuffer(Buffer.from(inferred)),
        bytes: Buffer.from(inferred).length,
      },
      'overrides_applied.geojson': {
        sha256: hashBuffer(Buffer.from(overridesPayload)),
        bytes: Buffer.from(overridesPayload).length,
      },
    }
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(base, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(3)
    expect(result.summary.districts?.[0]?.topFailCodes).toContain('OVERRIDES_SCHEMA_UNKNOWN')
  })

  it('warns on low quality metrics without failing when allowWarn', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-test-'))
    const dir = await writeDatasetFixture(base, 'xinyi')

    const metaPath = path.join(dir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    meta.curbMarkingKnownRate = 0.05
    meta.restrictionTriggeredRate = 0.005
    meta.overridesAppliedCount = 10
    meta.segmentsCount = 20
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(base, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: base,
      allowWarn: true,
      overrideReason: 'metrics check',
      datasetRootDir: base,
    })

    expect(result.exitCode).toBe(0)
    expect(result.summary.totals.warn).toBeGreaterThan(0)
  })

  it('warns on large diff deltas', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-diff-'))
    const publishedRoot = path.join(base, 'published')
    const nextRoot = path.join(base, 'next')
    await writeDatasetFixture(publishedRoot, 'xinyi')
    const nextDir = await writeDatasetFixture(nextRoot, 'xinyi')

    const metaPath = path.join(nextDir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    meta.segmentsCount = 200
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(nextRoot, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: nextRoot,
      datasetRootDir: nextRoot,
      publishedRootDir: publishedRoot,
    })

    expect(result.exitCode).toBe(2)
  }, 15000)

  it('escalates diff warns to fail when strict env is set', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-diff-strict-'))
    const publishedRoot = path.join(base, 'published')
    const nextRoot = path.join(base, 'next')
    await writeDatasetFixture(publishedRoot, 'xinyi')
    const nextDir = await writeDatasetFixture(nextRoot, 'xinyi')

    const metaPath = path.join(nextDir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    meta.segmentsCount = 200
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(nextRoot, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const previous = process.env.PARKKING_GATE_STRICT
    process.env.PARKKING_GATE_STRICT = '1'
    try {
      const result = await runPublishGate({
        reportPath,
        outputDir: nextRoot,
        datasetRootDir: nextRoot,
        publishedRootDir: publishedRoot,
      })

      expect(result.exitCode).toBe(3)
    } finally {
      if (previous === undefined) {
        delete process.env.PARKKING_GATE_STRICT
      } else {
        process.env.PARKKING_GATE_STRICT = previous
      }
    }
  })

  it('adopts baseline for adoptable diff fails when enabled', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-diff-adopt-'))
    const publishedRoot = path.join(base, 'published')
    const nextRoot = path.join(base, 'next')
    await writeDatasetFixture(publishedRoot, 'xinyi')
    const nextDir = await writeDatasetFixture(nextRoot, 'xinyi')

    const metaPath = path.join(nextDir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    meta.segmentsCount = 200
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(nextRoot, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const previousStrict = process.env.PARKKING_GATE_STRICT
    const previousAdopt = process.env.PARKKING_ALLOW_BASELINE_ADOPT
    process.env.PARKKING_GATE_STRICT = '1'
    process.env.PARKKING_ALLOW_BASELINE_ADOPT = '1'
    try {
      const result = await runPublishGate({
        reportPath,
        outputDir: nextRoot,
        datasetRootDir: nextRoot,
        publishedRootDir: publishedRoot,
        allowWarn: true,
        overrideReason: 'baseline adopt xinyi',
      })

      expect(result.exitCode).toBe(0)
      expect(result.summary.baselineAdopt).toEqual({
        enabled: true,
        applied: true,
        districtIds: ['xinyi'],
        reason: 'baseline_adopt',
      })
      expect(result.summary.gateMessageFlags).toContain('BASELINE_ADOPT_APPLIED')

      const stampPath = path.join(nextRoot, '_ops', 'baseline_adopt_stamps.jsonl')
      const rawStamp = await fs.readFile(stampPath, 'utf-8')
      expect(rawStamp).toContain('"reason":"baseline_adopt"')
      expect(rawStamp).toContain('"districtIds":["xinyi"]')
    } finally {
      if (previousStrict === undefined) {
        delete process.env.PARKKING_GATE_STRICT
      } else {
        process.env.PARKKING_GATE_STRICT = previousStrict
      }
      if (previousAdopt === undefined) {
        delete process.env.PARKKING_ALLOW_BASELINE_ADOPT
      } else {
        process.env.PARKKING_ALLOW_BASELINE_ADOPT = previousAdopt
      }
    }
  }, 15000)

  it('does not adopt baseline for non-diff hard fails', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-adopt-hard-'))
    await writeDatasetFixture(base, 'xinyi')
    const reportPath = await writeReport(base, {
      districts: [
        { districtId: 'xinyi', warnings: [{ severity: 'FAIL', code: 'PERF_REGRESSION', message: 'fail' }] },
      ],
    })

    const previousAdopt = process.env.PARKKING_ALLOW_BASELINE_ADOPT
    process.env.PARKKING_ALLOW_BASELINE_ADOPT = '1'
    try {
      const result = await runPublishGate({
        reportPath,
        outputDir: base,
        datasetRootDir: base,
        allowWarn: true,
        overrideReason: 'baseline adopt hard fail',
      })

      expect(result.exitCode).toBe(3)
      expect(result.summary.baselineAdopt).toEqual({
        enabled: true,
        applied: false,
        districtIds: [],
        reason: null,
      })
    } finally {
      if (previousAdopt === undefined) {
        delete process.env.PARKKING_ALLOW_BASELINE_ADOPT
      } else {
        process.env.PARKKING_ALLOW_BASELINE_ADOPT = previousAdopt
      }
    }
  })

  it('fails when segments drop to zero compared to previous pack', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'gate-diff-zero-'))
    const publishedRoot = path.join(base, 'published')
    const nextRoot = path.join(base, 'next')
    await writeDatasetFixture(publishedRoot, 'xinyi')
    const nextDir = await writeDatasetFixture(nextRoot, 'xinyi')

    const metaPath = path.join(nextDir, 'dataset_meta.json')
    const raw = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as Record<string, unknown>
    meta.segmentsCount = 0
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

    const reportPath = await writeReport(nextRoot, {
      districts: [{ districtId: 'xinyi', warnings: [] }],
    })

    const result = await runPublishGate({
      reportPath,
      outputDir: nextRoot,
      datasetRootDir: nextRoot,
      publishedRootDir: publishedRoot,
    })

    expect(result.exitCode).toBe(3)
  })
})
