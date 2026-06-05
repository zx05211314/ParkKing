import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { DistrictReadinessMatrixResult } from './districtReadinessMatrix'
import type { SmokeGeneratedPacksResult } from './smokeGeneratedPacks'
import type { SmokeParkingAnswerServicesResult } from './smokeParkingAnswerServices'
import type { PackageReleaseResult } from './packageRelease'
import type { ValidateReleasePackageResult } from './validateReleasePackage'
import {
  discoverReviewedDistrictIds,
  parseP3ReleaseReadinessArgs,
  renderP3ReleaseReadiness,
  runP3ReleaseReadiness,
  type P3ReleaseReadinessRunners,
} from './p3ReleaseReadiness'

const matrixPass = {
  hasBlockers: false,
  entries: [
    { districtId: 'xinyi', blockers: [] },
    { districtId: 'daan', blockers: [] },
    { districtId: 'zhongshan', blockers: [] },
  ],
} as unknown as DistrictReadinessMatrixResult

const generatedPacksPass = {
  hasErrors: false,
  packResults: [
    { districtId: 'xinyi', errors: [] },
    { districtId: 'daan', errors: [] },
    { districtId: 'zhongshan', errors: [] },
  ],
} as unknown as SmokeGeneratedPacksResult

const generatedPacksBlocked = {
  hasErrors: true,
  packResults: [
    { districtId: 'xinyi', errors: ['reviewed answer drift'] },
    { districtId: 'daan', errors: [] },
    { districtId: 'zhongshan', errors: [] },
  ],
} as unknown as SmokeGeneratedPacksResult

const parkingAnswerApisPass: SmokeParkingAnswerServicesResult = {
  root: 'public/data/generated',
  registryPath: 'public/data/generated/registry.json',
  reportPath: null,
  errors: [],
  hasErrors: false,
  packResults: [
    { districtId: 'xinyi', errors: [] },
    { districtId: 'daan', errors: [] },
    { districtId: 'zhongshan', errors: [] },
  ],
} as unknown as SmokeParkingAnswerServicesResult

const releasePackagePass: PackageReleaseResult = {
  releaseId: 'release-1',
  zipPath: 'dist/releases/park-king-data_release-1.zip',
  manifestPath: 'dist/releases/release_manifest_release-1.json',
  baseDir: 'public/data/generated',
  districtIds: ['xinyi', 'daan', 'zhongshan'],
  releaseDistricts: [
    {
      districtId: 'daan',
      datasetHash: 'hash-daan',
      publishedAt: '2026-05-01T00:00:00Z',
    },
    {
      districtId: 'xinyi',
      datasetHash: 'hash-xinyi',
      publishedAt: '2026-05-01T00:00:00Z',
    },
    {
      districtId: 'zhongshan',
      datasetHash: 'hash-zhongshan',
      publishedAt: '2026-05-01T00:00:00Z',
    },
  ],
  fileCount: 100,
  totalBytes: 12345,
}

const packageValidationPass: ValidateReleasePackageResult = {
  releaseId: 'release-1',
  zipPath: releasePackagePass.zipPath,
  manifestPath: releasePackagePass.manifestPath,
  pass: true,
  expectedDistrictIds: ['xinyi', 'daan', 'zhongshan'],
  registryDistrictIds: ['daan', 'xinyi', 'zhongshan'],
  manifestDistrictIds: ['daan', 'xinyi', 'zhongshan'],
  fileCount: 100,
  totalBytes: 12345,
  errors: [],
}

const makeRunners = (
  overrides: Partial<P3ReleaseReadinessRunners> = {},
): P3ReleaseReadinessRunners => ({
  runDistrictReadinessMatrix: vi.fn().mockResolvedValue(matrixPass),
  runSmokeGeneratedPacks: vi.fn().mockResolvedValue(generatedPacksPass),
  runSmokeParkingAnswerServices: vi.fn().mockResolvedValue(parkingAnswerApisPass),
  packageRelease: vi.fn().mockResolvedValue(releasePackagePass),
  validateReleasePackage: vi.fn().mockResolvedValue(packageValidationPass),
  ...overrides,
})

describe('p3ReleaseReadiness', () => {
  it('parses explicit P3 release readiness options', () => {
    expect(
      parseP3ReleaseReadinessArgs([
        'node',
        'p3ReleaseReadiness',
        '--root',
        'public/data/generated',
        '--registry',
        'public/data/generated/registry.json',
        '--configs',
        'configs/prod/*.json',
        '--answer-cases',
        'configs/prod/*.answer-cases.json',
        '--district',
        'xinyi,daan,zhongshan',
        '--out-dir',
        'dist/releases',
        '--include',
        'public/data/generated/**',
        '--release-id',
        '20260605140713_21e282f',
        '--out',
        '.tmp/p3.md',
        '--json-out',
        '.tmp/p3.json',
        '--json',
      ]),
    ).toMatchObject({
      root: 'public/data/generated',
      registryPath: 'public/data/generated/registry.json',
      configGlob: 'configs/prod/*.json',
      answerCasesGlob: 'configs/prod/*.answer-cases.json',
      districtIds: ['xinyi', 'daan', 'zhongshan'],
      outDir: 'dist/releases',
      includeGlob: 'public/data/generated/**',
      releaseId: '20260605140713_21e282f',
      outPath: '.tmp/p3.md',
      jsonOutPath: '.tmp/p3.json',
      json: true,
    })
  })

  it('discovers reviewed district ids from answer-case files', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'p3-reviewed-cases-'))
    await fs.writeFile(path.join(base, 'zhongshan.answer-cases.json'), '{}')
    await fs.writeFile(path.join(base, 'daan.answer-cases.json'), '{}')

    await expect(
      discoverReviewedDistrictIds(path.join(base, '*.answer-cases.json').replace(/\\/g, '/')),
    ).resolves.toEqual(['daan', 'zhongshan'])
  })

  it('passes when matrix, reviewed pack smoke, package, and validation pass', async () => {
    const runners = makeRunners()
    const result = await runP3ReleaseReadiness(
      {
        districtIds: ['xinyi', 'daan', 'zhongshan'],
      },
      runners,
    )

    expect(result.pass).toBe(true)
    expect(result.blockers).toEqual([])
    expect(runners.runDistrictReadinessMatrix).toHaveBeenCalledWith(
      expect.objectContaining({
        answerCasesGlob: 'configs/prod/*.answer-cases.json',
      }),
    )
    expect(runners.runSmokeGeneratedPacks).toHaveBeenCalledWith(
      expect.objectContaining({
        answerCasesDir: 'configs/prod',
        useReviewedCases: true,
        requiredReviewedCaseDistricts: ['xinyi', 'daan', 'zhongshan'],
      }),
    )
    expect(runners.packageRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        districtIds: ['xinyi', 'daan', 'zhongshan'],
        releaseId: null,
      }),
    )
    const apiCall = vi.mocked(runners.runSmokeParkingAnswerServices).mock.calls[0]?.[0]
    expect(apiCall).toMatchObject({
      root: 'public/data/generated',
      answerCasesDir: 'configs/prod',
      useReviewedCases: true,
      requiredReviewedCaseDistricts: ['xinyi', 'daan', 'zhongshan'],
    })
    expect(apiCall?.registryPath?.replace(/\\/g, '/')).toBe(
      'public/data/generated/registry.json',
    )
    expect(runners.validateReleasePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        zipPath: releasePackagePass.zipPath,
        manifestPath: releasePackagePass.manifestPath,
        districtIds: ['xinyi', 'daan', 'zhongshan'],
      }),
    )
    const output = renderP3ReleaseReadiness(result)
    expect(output).toContain('# P3 Reviewed Release Readiness: PASS')
    expect(output).toContain('## Release Artifacts')
    expect(output).toContain('- Release ID: release-1')
    expect(output).toContain('- Zip: dist/releases/park-king-data_release-1.zip')
  })

  it('passes an explicit release id to release packaging', async () => {
    const runners = makeRunners()
    await runP3ReleaseReadiness(
      {
        districtIds: ['xinyi', 'daan', 'zhongshan'],
        releaseId: '20260605140713_21e282f',
      },
      runners,
    )

    expect(runners.packageRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: '20260605140713_21e282f',
      }),
    )
  })

  it('blocks when package validation fails', async () => {
    const result = await runP3ReleaseReadiness(
      {
        districtIds: ['xinyi', 'daan', 'zhongshan'],
      },
      makeRunners({
        validateReleasePackage: vi.fn().mockResolvedValue({
          ...packageValidationPass,
          pass: false,
          errors: ['registry mismatch'],
        }),
      }),
    )

    expect(result.pass).toBe(false)
    expect(result.blockers).toEqual(['Release package validation: failed'])
    expect(renderP3ReleaseReadiness(result)).toContain(
      '# P3 Reviewed Release Readiness: BLOCKED',
    )
  })

  it('does not create a release package when prerequisite checks fail', async () => {
    const runners = makeRunners({
      runSmokeGeneratedPacks: vi.fn().mockResolvedValue(generatedPacksBlocked),
    })

    const result = await runP3ReleaseReadiness(
      {
        districtIds: ['xinyi', 'daan', 'zhongshan'],
      },
      runners,
    )

    expect(result.pass).toBe(false)
    expect(result.blockers).toEqual(['Reviewed generated packs: failed'])
    expect(result.releasePackage.skipped).toBe(true)
    expect(result.packageValidation.skipped).toBe(true)
    expect(runners.packageRelease).not.toHaveBeenCalled()
    expect(runners.validateReleasePackage).not.toHaveBeenCalled()
    const output = renderP3ReleaseReadiness(result)
    expect(output).toContain(
      '| SKIP | Release package | - | skipped because prior readiness checks failed |',
    )
    expect(output).not.toContain('## Release Artifacts')
  })
})
