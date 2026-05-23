import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { DistrictReadinessMatrixResult } from './districtReadinessMatrix'
import type { SmokeGeneratedPacksResult } from './smokeGeneratedPacks'
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

const releasePackagePass: PackageReleaseResult = {
  releaseId: 'release-1',
  zipPath: 'dist/releases/park-king-data_release-1.zip',
  manifestPath: 'dist/releases/release_manifest_release-1.json',
  baseDir: 'public/data/generated',
  districtIds: ['xinyi', 'daan', 'zhongshan'],
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
  fileCount: 100,
  totalBytes: 12345,
  errors: [],
}

const makeRunners = (
  overrides: Partial<P3ReleaseReadinessRunners> = {},
): P3ReleaseReadinessRunners => ({
  runDistrictReadinessMatrix: vi.fn().mockResolvedValue(matrixPass),
  runSmokeGeneratedPacks: vi.fn().mockResolvedValue(generatedPacksPass),
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
    expect(runners.runSmokeGeneratedPacks).toHaveBeenCalledWith(
      expect.objectContaining({
        useReviewedCases: true,
        requiredReviewedCaseDistricts: ['xinyi', 'daan', 'zhongshan'],
      }),
    )
    expect(runners.packageRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        districtIds: ['xinyi', 'daan', 'zhongshan'],
      }),
    )
    expect(runners.validateReleasePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        zipPath: releasePackagePass.zipPath,
        manifestPath: releasePackagePass.manifestPath,
        districtIds: ['xinyi', 'daan', 'zhongshan'],
      }),
    )
    expect(renderP3ReleaseReadiness(result)).toContain(
      '# P3 Reviewed Release Readiness: PASS',
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
})
