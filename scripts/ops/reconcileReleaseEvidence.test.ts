import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { InstallReleasePackageResult } from './installReleasePackage'
import {
  applyReconciledFiles,
  baselineIdentityPayload,
  parseReconcileReleaseEvidenceArgs,
  reconcileReleaseEvidence,
  renderReconcileReleaseEvidence,
  type ReconcileReleaseEvidenceDependencies,
} from './reconcileReleaseEvidence'

const writeJson = async (targetPath: string, value: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const readJson = async <T>(targetPath: string) =>
  JSON.parse(await fs.readFile(targetPath, 'utf-8')) as T

const createFixture = async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'release-evidence-reconcile-'),
  )
  const answerCasesDir = path.join(root, 'configs')
  const baselineDir = path.join(root, 'baselines')
  const tmpDir = path.join(root, '.tmp')
  await writeJson(path.join(answerCasesDir, 'xinyi.answer-cases.json'), {
    schemaVersion: 1,
    districtId: 'xinyi',
    datasetHash: 'old-hash',
    cases: [{ id: 'reviewed-1' }],
  })
  await writeJson(path.join(baselineDir, 'xinyi.json'), {
    baselineCreatedAt: 'old-time',
    generatedAt: 'old-time',
    performance: { day: { evalFirstMsMedian: 10 } },
    districtId: 'xinyi',
    datasetHash: 'old-hash',
    counts: { segments: 1 },
  })
  return { root, answerCasesDir, baselineDir, tmpDir }
}

const createDependencies = (
  overrides: Partial<ReconcileReleaseEvidenceDependencies> = {},
): ReconcileReleaseEvidenceDependencies => ({
  installPackage: vi.fn(async (args) => {
    const outRoot = path.resolve(args.outRoot ?? '')
    await writeJson(path.join(outRoot, 'registry.json'), {
      districts: [{ districtId: 'xinyi' }],
    })
    await writeJson(path.join(outRoot, 'xinyi', 'dataset_meta.json'), {
      districtId: 'xinyi',
      datasetHash: 'new-hash',
    })
    return {
      outRoot,
      registryDistrictIds: ['xinyi'],
      fileCount: 2,
      source: 'release.zip',
      manifestSource: 'manifest.json',
      extractedFiles: 2,
      manifestValidation: {
        pass: true,
        releaseId: 'release-1',
        zipPath: 'release.zip',
        manifestPath: 'manifest.json',
        expectedDistrictIds: [],
        registryDistrictIds: ['xinyi'],
        manifestDistrictIds: ['xinyi'],
        fileCount: 2,
        totalBytes: 100,
        errors: [],
      },
    } satisfies InstallReleasePackageResult
  }),
  refreshAnswerCases: vi.fn(async (options) => {
    const casesPath = path.join(
      path.resolve(options.answerCasesDir ?? ''),
      'xinyi.answer-cases.json',
    )
    const payload = await readJson<Record<string, unknown>>(casesPath)
    await writeJson(casesPath, { ...payload, datasetHash: 'new-hash' })
    return {
      pass: true,
      execute: true,
      datasetRoot: path.resolve(options.datasetRoot ?? ''),
      answerCasesDir: path.resolve(options.answerCasesDir ?? ''),
      requestedDistrictIds: ['xinyi'],
      refreshed: [
        {
          districtId: 'xinyi',
          casesPath,
          datasetDir: path.join(
            path.resolve(options.datasetRoot ?? ''),
            'xinyi',
          ),
          caseCount: 1,
          previousDatasetHash: 'old-hash',
          runtimeDatasetHash: 'new-hash',
          semanticValidationPassed: true,
          status: 'repinned',
          errors: [],
        },
      ],
      errors: [],
    }
  }),
  generateBaselines: vi.fn(async (_datasetRoot, baselineDir) => {
    await writeJson(path.join(baselineDir, 'xinyi.json'), {
      baselineCreatedAt: 'new-time',
      generatedAt: 'new-time',
      performance: { day: { evalFirstMsMedian: 25 } },
      districtId: 'xinyi',
      datasetHash: 'new-hash',
      counts: { segments: 2 },
    })
    return { districtIds: ['xinyi'] }
  }),
  ...overrides,
})

describe('reconcileReleaseEvidence', () => {
  it('parses release sources, target paths, and safe report-only defaults', () => {
    expect(
      parseReconcileReleaseEvidenceArgs([
        'node',
        'reconcile',
        '--package-url',
        'https://example.test/release.zip',
        '--manifest-url',
        'https://example.test/manifest.json',
        '--answer-cases-dir',
        '.tmp/configs',
        '--baseline-dir',
        '.tmp/baselines',
        '--execute',
        '--json',
      ]),
    ).toMatchObject({
      packageUrl: 'https://example.test/release.zip',
      manifestUrl: 'https://example.test/manifest.json',
      answerCasesDir: '.tmp/configs',
      baselineDir: '.tmp/baselines',
      execute: true,
      json: true,
    })
    expect(
      parseReconcileReleaseEvidenceArgs(['node', 'reconcile']),
    ).toMatchObject({
      execute: false,
      tmpDir: '.tmp/release-evidence-reconcile',
      outPath: '.tmp/release-evidence-reconcile.md',
      jsonOutPath: '.tmp/release-evidence-reconcile.json',
    })
  })

  it('stages and reports all changes without modifying tracked evidence', async () => {
    const fixture = await createFixture()
    const beforeCases = await fs.readFile(
      path.join(fixture.answerCasesDir, 'xinyi.answer-cases.json'),
      'utf-8',
    )
    const result = await reconcileReleaseEvidence(
      {
        zipPath: 'release.zip',
        manifestPath: 'manifest.json',
        ...fixture,
      },
      createDependencies(),
    )

    expect(result).toMatchObject({
      pass: true,
      execute: false,
      releaseId: 'release-1',
      districtIds: ['xinyi'],
      caseCount: 1,
      semanticValidationPassed: true,
      baselineGenerationPassed: true,
    })
    expect(result.files.map(({ status }) => status)).toEqual([
      'would-update',
      'would-update',
    ])
    await expect(
      fs.readFile(
        path.join(fixture.answerCasesDir, 'xinyi.answer-cases.json'),
        'utf-8',
      ),
    ).resolves.toBe(beforeCases)
    expect(renderReconcileReleaseEvidence(result)).toContain(
      'Mode: report-only',
    )
  })

  it('updates cases and baselines only after all staged checks pass', async () => {
    const fixture = await createFixture()
    const result = await reconcileReleaseEvidence(
      {
        zipPath: 'release.zip',
        manifestPath: 'manifest.json',
        ...fixture,
        execute: true,
      },
      createDependencies(),
    )

    expect(result.pass).toBe(true)
    expect(result.files.map(({ status }) => status)).toEqual([
      'updated',
      'updated',
    ])
    await expect(
      readJson<{ datasetHash: string }>(
        path.join(fixture.answerCasesDir, 'xinyi.answer-cases.json'),
      ),
    ).resolves.toMatchObject({ datasetHash: 'new-hash' })
    await expect(
      readJson<{ datasetHash: string }>(
        path.join(fixture.baselineDir, 'xinyi.json'),
      ),
    ).resolves.toMatchObject({ datasetHash: 'new-hash' })
  })

  it('does not modify targets when semantic validation fails', async () => {
    const fixture = await createFixture()
    const beforeCases = await fs.readFile(
      path.join(fixture.answerCasesDir, 'xinyi.answer-cases.json'),
      'utf-8',
    )
    const dependencies = createDependencies({
      refreshAnswerCases: vi.fn(async (options) => ({
        pass: false,
        execute: true,
        datasetRoot: path.resolve(options.datasetRoot ?? ''),
        answerCasesDir: path.resolve(options.answerCasesDir ?? ''),
        requestedDistrictIds: ['xinyi'],
        refreshed: [
          {
            districtId: 'xinyi',
            casesPath: 'xinyi.answer-cases.json',
            datasetDir: 'xinyi',
            caseCount: 1,
            previousDatasetHash: 'old-hash',
            runtimeDatasetHash: 'new-hash',
            semanticValidationPassed: false,
            status: 'failed',
            errors: ['answer kind changed'],
          },
        ],
        errors: ['semantic mismatch'],
      })),
    })
    const result = await reconcileReleaseEvidence(
      {
        zipPath: 'release.zip',
        manifestPath: 'manifest.json',
        ...fixture,
        execute: true,
      },
      dependencies,
    )

    expect(result.pass).toBe(false)
    expect(result.errors.join(' ')).toContain('semantic mismatch')
    expect(dependencies.generateBaselines).not.toHaveBeenCalled()
    await expect(
      fs.readFile(
        path.join(fixture.answerCasesDir, 'xinyi.answer-cases.json'),
        'utf-8',
      ),
    ).resolves.toBe(beforeCases)
  })

  it('requires staged cases and baselines to cover every release district', async () => {
    const fixture = await createFixture()
    const dependencies = createDependencies({
      generateBaselines: vi.fn(async () => ({ districtIds: [] })),
    })
    const result = await reconcileReleaseEvidence(
      {
        zipPath: 'release.zip',
        manifestPath: 'manifest.json',
        ...fixture,
        execute: true,
      },
      dependencies,
    )

    expect(result.pass).toBe(false)
    expect(result.errors.join(' ')).toContain(
      'do not match release districts xinyi',
    )
    expect(result.files).toEqual([])
  })

  it('treats timestamps and benchmark variance as unchanged for one dataset', () => {
    expect(
      baselineIdentityPayload({
        baselineCreatedAt: 'new-time',
        generatedAt: 'new-time',
        performance: { day: { evalFirstMsMedian: 90 } },
        districtId: 'xinyi',
        datasetHash: 'same-hash',
      }),
    ).toEqual({
      districtId: 'xinyi',
      datasetHash: 'same-hash',
    })
  })

  it('rolls back earlier writes when a later target cannot be copied', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reconcile-rollback-'))
    const sourceA = path.join(root, 'source-a.json')
    const targetA = path.join(root, 'target-a.json')
    const missingSource = path.join(root, 'missing.json')
    const targetB = path.join(root, 'target-b.json')
    await fs.writeFile(sourceA, 'new-a')
    await fs.writeFile(targetA, 'old-a')
    await fs.writeFile(targetB, 'old-b')

    await expect(
      applyReconciledFiles([
        {
          districtId: 'xinyi',
          kind: 'answer-cases',
          sourcePath: sourceA,
          targetPath: targetA,
          changed: true,
        },
        {
          districtId: 'xinyi',
          kind: 'baseline',
          sourcePath: missingSource,
          targetPath: targetB,
          changed: true,
        },
      ]),
    ).rejects.toThrow()
    await expect(fs.readFile(targetA, 'utf-8')).resolves.toBe('old-a')
    await expect(fs.readFile(targetB, 'utf-8')).resolves.toBe('old-b')
  })
})
