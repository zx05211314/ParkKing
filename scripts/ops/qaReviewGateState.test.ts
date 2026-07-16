import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import { ingestDistrictBounds } from '../ingest/ingestDistrictBounds'
import { ingestSignOverrides } from '../ingest/ingestSignOverrides'
import { readConfig } from '../ingest/readConfig'
import { applyQaReviewHandoff } from './qaReviewApplyState'
import { buildQaReviewGate } from './qaReviewGateState'

const writeJson = async (targetPath: string, payload: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

const readJson = async <T>(targetPath: string): Promise<T> => {
  const raw = await fs.readFile(targetPath, 'utf-8')
  return JSON.parse(raw) as T
}

const writeAdjacentManifest = async (inputPath: string, payload: unknown) => {
  const manifestPath = inputPath.replace(/\.csv$/i, '.manifest.json')
  await writeJson(manifestPath, payload)
  return manifestPath
}

const buildFixture = async () => {
  const repoRoot = process.cwd()
  const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-gate-'))
  const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'xinyi')
  const configPath = path.join(base, 'xinyi.json')
  const inputPath = path.join(base, 'review.csv')
  const outDir = path.join(base, 'out')

  await writeJson(configPath, {
    districtId: 'xinyi',
    districtName: 'Xinyi Test',
    inputs: {
      districtBounds: path.join(fixturesDir, 'xinyi_boundary.geojson'),
      redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
      busStops: path.join(fixturesDir, 'bus_stops.geojson'),
      hydrants: path.join(fixturesDir, 'hydrants.geojson'),
    },
    outputs: {
      generatedDir: path.join(base, 'generated'),
      publicDir: path.join(base, 'public'),
    },
    crs: { default: 'EPSG:4326' },
  })

  return { base, configPath, inputPath, outDir }
}

describe('buildQaReviewGate', () => {
  it('exports and preflights reviewed QA rows in one gate', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
      requireStatuses: ['LEGAL'],
      requireBuckets: ['marked_space_park'],
    })

    expect(result.pass).toBe(true)
    expect(result.inputKind).toBe('csv')
    expect(result.exports).toHaveLength(1)
    expect(result.exports[0]?.districtId).toBe('xinyi')
    expect(result.preflight?.matchedSegmentOverrides).toBe(1)
    expect(result.warnings).toContain(
      `Override output directory ${outDir} is not the ingest default ${path.resolve('data', 'overrides')}; ingestSignOverrides reads the default path unless the file is copied there.`,
    )
    await expect(fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')).resolves.toContain(
      '"segmentId":"seg-1"',
    )
  })

  it('writes default gate output where ingestSignOverrides reads it', async () => {
    const { base, configPath, inputPath } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const originalCwd = process.cwd()
    process.chdir(base)
    try {
      const result = await buildQaReviewGate({
        inputPath,
        configPath,
        minReviewed: 1,
        requireStatuses: ['LEGAL'],
        requireBuckets: ['marked_space_park'],
      })

      const defaultOverridePath = path.join(base, 'data', 'overrides', 'xinyi.jsonl')
      expect(result.pass).toBe(true)
      expect(result.outDir).toBe(path.join(base, 'data', 'overrides'))
      expect(result.preflight?.inputPath).toBe(defaultOverridePath)
      expect(result.warnings.some((warning) => warning.includes('not the ingest default'))).toBe(
        false,
      )
      await expect(fs.readFile(defaultOverridePath, 'utf-8')).resolves.toContain(
        '"segmentId":"seg-1"',
      )

      const config = await readConfig(['node', 'test', '--config', configPath])
      await ingestDistrictBounds(config)
      await ingestSignOverrides(config)

      const applied = await readJson<FeatureCollection>(
        path.join(base, 'generated', 'overrides_applied.geojson'),
      )
      expect(applied.features).toHaveLength(1)
      expect(applied.features[0]?.properties?.segmentId).toBe('seg-1')
      expect(applied.features[0]?.properties?.override_status).toBe('LEGAL')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('accepts a merged review CSV with the manifest written by applyQaReviewHandoff', async () => {
    const { base, configPath, inputPath, outDir } = await buildFixture()
    const reviewsPath = path.join(base, 'next-review.csv')
    const mergedPath = path.join(base, 'review.merged.csv')
    const config = await readConfig(['node', 'test', '--config', configPath])
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
      'utf-8',
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: inputPath,
      dataset: {
        datasetHash: config.datasetSourceHash,
        configHash: config.configHash,
      },
      params: {},
      rows: { total: 1 },
    })
    await fs.writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,sourceDatasetHash,sourceConfigHash,sourceRowsTotal,reviewStatus,reviewNote,createdAt',
        `2,xinyi,seg-1,marked_space_park,${config.datasetSourceHash},${config.configHash},1,LEGAL,field checked,2026-04-20T00:00:00.000Z`,
      ].join('\n'),
      'utf-8',
    )

    const applyResult = await applyQaReviewHandoff({
      sourcePath: inputPath,
      reviewsPath,
      outPath: mergedPath,
    })
    expect(applyResult.pass).toBe(true)
    expect(applyResult.manifestPath).toBe(mergedPath.replace(/\.csv$/i, '.manifest.json'))

    const gateResult = await buildQaReviewGate({
      inputPath: mergedPath,
      configPath,
      outDir,
      minReviewed: 1,
      requireStatuses: ['LEGAL'],
      requireBuckets: ['marked_space_park'],
    })

    expect(gateResult.pass).toBe(true)
    expect(gateResult.summary.manifest?.csvPath).toBe(mergedPath)
    expect(gateResult.summary.manifest?.datasetHash).toBe(config.datasetSourceHash)
    expect(gateResult.summary.manifest?.configHash).toBe(config.configHash)
    expect(gateResult.preflight?.matchedSegmentOverrides).toBe(1)
    await expect(fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')).resolves.toContain(
      '"segmentId":"seg-1"',
    )
  })

  it('fails before export when the CSV has no reviewed rows', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({ inputPath, configPath, outDir })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.preflight).toBeNull()
    expect(result.errors).toContain(
      'Valid reviewed rows 0 is below required minimum 1.',
    )
  })

  it('fails before export when a review CSV manifest is stale', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )
    const otherCsvPath = path.join(path.dirname(inputPath), 'other.csv')
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: otherCsvPath,
      dataset: {},
      params: {},
      rows: { total: 1 },
    })

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.errors).toContain(
      `Review manifest csvPath ${otherCsvPath} does not match input ${inputPath}.`,
    )
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails before export when reviewed bucket minimums are not met', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
        'xinyi,seg-2,no_stop,ILLEGAL,no stopping sign,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
      minReviewedBuckets: { marked_space_park: 2, no_stop: 1 },
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.preflight).toBeNull()
    expect(result.errors).toContain(
      'Reviewed rows for bucket marked_space_park 1 is below required minimum 2.',
    )
    expect(result.summary.reviewRequirements.bucketMinimumsRemaining).toEqual({
      marked_space_park: 1,
    })
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails before export when reviewed CSV rows are invalid', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
        'xinyi,seg-2,no_stop,MAYBE,invalid status,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.errors).toContain(
      '1 reviewed row(s) use a status outside LEGAL, ILLEGAL, UNCLEAR.',
    )
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails before export when reviewed CSV rows lack evidence note or timestamp', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.errors).toContain(
      '1 reviewed row(s) are missing reviewNote or createdAt.',
    )
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails before export when reviewed CSV rows duplicate a segment', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
        'xinyi,seg-1,no_stop,ILLEGAL,conflicting check,2026-04-21T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.preflight).toBeNull()
    expect(result.summary.duplicateReviewedSegments).toBe(1)
    expect(result.summary.conflictingReviewedSegments).toBe(1)
    expect(result.errors).toContain(
      '1 segment(s) have multiple reviewed rows; export would collapse 1 reviewed row(s) to the latest verdict.',
    )
    expect(result.errors).toContain(
      '1 segment(s) have conflicting reviewed statuses for the same districtId+segmentId.',
    )
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails before export when review manifest targets another district config', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'daan',
      csvPath: inputPath,
      dataset: {},
      params: {},
      rows: { total: 1 },
    })

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.errors).toContain(
      'Review manifest district daan does not match config district xinyi.',
    )
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails before export when review manifest config hash is stale', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: inputPath,
      dataset: {
        configHash: 'stale-config-hash',
      },
      params: {},
      rows: { total: 1 },
    })

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(
      result.errors.some((error) =>
        error.startsWith('Review manifest config hash stale-config-hash does not match current config hash '),
      ),
    ).toBe(true)
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('can downgrade config provenance mismatch to a warning while still preflighting segments', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: inputPath,
      dataset: {
        configHash: 'stale-config-hash',
      },
      params: {},
      rows: { total: 1 },
    })

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
      strictConfigProvenance: false,
    })

    expect(result.pass).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(
      result.warnings.some((warning) =>
        warning.startsWith('Review manifest config hash stale-config-hash does not match current config hash '),
      ),
    ).toBe(true)
    expect(result.preflight?.matchedSegmentOverrides).toBe(1)
    await expect(fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')).resolves.toContain(
      '"segmentId":"seg-1"',
    )
  })

  it('fails before export when review manifest dataset hash is stale', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: inputPath,
      dataset: {
        datasetHash: 'stale-dataset-hash',
      },
      params: {},
      rows: { total: 1 },
    })

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(
      result.errors.some((error) =>
        error.startsWith('Review manifest source hash stale-dataset-hash does not match current source hash '),
      ),
    ).toBe(true)
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails before export when the reviewed generator contract is stale', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    const config = await readConfig(['node', 'test', '--config', configPath])
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: inputPath,
      dataset: {
        datasetHash: 'runtime-content-hash',
        datasetSourceHash: config.datasetSourceHash,
        generatorHash: 'stale-generator-hash',
        configHash: config.configHash,
      },
      params: {},
      rows: { total: 1 },
    })

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(
      result.errors.some((error) =>
        error.startsWith(
          'Review manifest generator hash stale-generator-hash does not match current generator hash ',
        ),
      ),
    ).toBe(true)
  })

  it('fails report input before export when reviewed reports are invalid', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        JSON.stringify({
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-1',
          status: 'LEGAL',
          note: 'field checked',
          createdAt: '2026-04-20T00:00:00.000Z',
        }),
        JSON.stringify({
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-2',
          status: 'MAYBE',
          note: 'invalid status check',
          createdAt: '2026-04-20T00:00:00.000Z',
        }),
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.inputKind).toBe('reports')
    expect(result.exports).toHaveLength(0)
    expect(result.errors).toContain(
      '1 reviewed row(s) use a status outside LEGAL, ILLEGAL, UNCLEAR.',
    )
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails report input before export when reviewed reports duplicate a segment', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        JSON.stringify({
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-1',
          status: 'LEGAL',
          note: 'first check',
          createdAt: '2026-04-20T00:00:00.000Z',
        }),
        JSON.stringify({
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-1-part-1',
          status: 'ILLEGAL',
          note: 'second check',
          createdAt: '2026-04-21T00:00:00.000Z',
        }),
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.inputKind).toBe('reports')
    expect(result.exports).toHaveLength(0)
    expect(result.preflight).toBeNull()
    expect(result.summary.duplicateReviewedSegments).toBe(1)
    expect(result.summary.conflictingReviewedSegments).toBe(1)
    expect(result.errors).toContain(
      '1 segment(s) have conflicting reviewed statuses for the same districtId+segmentId.',
    )
    await expect(fs.access(path.join(outDir, 'xinyi.jsonl'))).rejects.toThrow()
  })

  it('fails when reviewed rows reference unknown segments', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-missing,no_stop,ILLEGAL,not in pack,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGate({ inputPath, configPath, outDir })

    expect(result.pass).toBe(false)
    expect(result.preflight?.missingSegmentOverrides).toBe(1)
    expect(result.errors).toContain('1 override(s) reference unknown segment ids.')
  })

  it('exports and preflights JSONL report input without requiring a QA CSV', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      `${JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        note: 'reported in app',
        createdAt: '2026-04-20T00:00:00.000Z',
      })}\n`,
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
      requireStatuses: ['LEGAL'],
    })

    expect(result.pass).toBe(true)
    expect(result.inputKind).toBe('reports')
    expect(result.summary.validReviewedRows).toBe(1)
    expect(result.summary.bucketCounts).toEqual({})
    expect(result.preflight?.matchedSegmentOverrides).toBe(1)
    await expect(fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')).resolves.toContain(
      '"status":"LEGAL"',
    )
  })

  it('fails report input when bucket coverage is required', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      `${JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        note: 'field checked',
        createdAt: '2026-04-20T00:00:00.000Z',
      })}\n`,
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
      requireBuckets: ['marked_space_park'],
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.errors).toContain(
      'Report input has no reviewBucket column; cannot verify required bucket marked_space_park. Use QA review CSV input for bucket coverage.',
    )
  })

  it('fails report input when bucket minimum coverage is required', async () => {
    const { configPath, inputPath, outDir } = await buildFixture()
    await fs.writeFile(
      inputPath,
      `${JSON.stringify({
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        note: 'field checked',
        createdAt: '2026-04-20T00:00:00.000Z',
      })}\n`,
      'utf-8',
    )

    const result = await buildQaReviewGate({
      inputPath,
      configPath,
      outDir,
      minReviewed: 1,
      minReviewedBuckets: { marked_space_park: 2 },
    })

    expect(result.pass).toBe(false)
    expect(result.exports).toHaveLength(0)
    expect(result.errors).toContain(
      'Report input has no reviewBucket column; cannot verify minimum 2 reviewed row(s) for bucket marked_space_park. Use QA review CSV input for bucket coverage.',
    )
  })
})
