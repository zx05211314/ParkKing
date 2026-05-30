import { describe, expect, it, vi } from 'vitest'
import type { P1ReleaseReadinessResult } from './p1ReleaseReadiness'
import type { PackageReleaseResult } from './packageRelease'
import type { ValidateReleasePackageResult } from './validateReleasePackage'
import {
  parseCiOptionalP1ReleaseArgs,
  renderCiOptionalP1Release,
  runCiOptionalP1Release,
  type CiOptionalP1ReleaseRunners,
} from './ciOptionalP1Release'

const readinessPass = {
  pass: true,
  blockers: [],
} as unknown as P1ReleaseReadinessResult

const readinessBlocked = {
  pass: false,
  blockers: ['P0 readiness: failed'],
} as unknown as P1ReleaseReadinessResult

const releasePackagePass: PackageReleaseResult = {
  releaseId: 'release-1',
  zipPath: 'dist/releases/park-king-data_release-1.zip',
  manifestPath: 'dist/releases/release_manifest_release-1.json',
  baseDir: 'public/data/generated',
  districtIds: ['xinyi'],
  releaseDistricts: [
    {
      districtId: 'xinyi',
      datasetHash: 'hash-xinyi',
      publishedAt: '2026-05-01T00:00:00Z',
    },
  ],
  fileCount: 10,
  totalBytes: 1234,
}

const validationPass: ValidateReleasePackageResult = {
  releaseId: 'release-1',
  zipPath: releasePackagePass.zipPath,
  manifestPath: releasePackagePass.manifestPath,
  pass: true,
  expectedDistrictIds: ['xinyi'],
  registryDistrictIds: ['xinyi'],
  manifestDistrictIds: ['xinyi'],
  fileCount: 10,
  totalBytes: 1234,
  errors: [],
}

const makeRunners = (
  overrides: Partial<CiOptionalP1ReleaseRunners> = {},
): CiOptionalP1ReleaseRunners => ({
  fileExists: vi.fn().mockResolvedValue(true),
  runP1ReleaseReadiness: vi.fn().mockResolvedValue(readinessPass),
  packageRelease: vi.fn().mockResolvedValue(releasePackagePass),
  validateReleasePackage: vi.fn().mockResolvedValue(validationPass),
  ...overrides,
})

describe('ciOptionalP1Release', () => {
  it('parses CI optional release args', () => {
    expect(
      parseCiOptionalP1ReleaseArgs([
        'node',
        'ciOptionalP1Release',
        '--district',
        'xinyi',
        '--root',
        'public/data/generated',
        '--registry',
        'public/data/generated/registry.json',
        '--configs',
        'configs/prod/*.json',
        '--timeout-ms',
        '12000',
        '--out-dir',
        'dist/releases',
        '--out',
        '.tmp/p1.md',
        '--json-out',
        '.tmp/p1.json',
      ]),
    ).toMatchObject({
      districtId: 'xinyi',
      root: 'public/data/generated',
      registryPath: 'public/data/generated/registry.json',
      configGlob: 'configs/prod/*.json',
      timeoutMs: 12000,
      outDir: 'dist/releases',
      markdownOutPath: '.tmp/p1.md',
      jsonOutPath: '.tmp/p1.json',
    })
  })

  it('skips clean checkout release packaging when generated registry is absent', async () => {
    const runners = makeRunners({
      fileExists: vi.fn().mockResolvedValue(false),
    })

    const result = await runCiOptionalP1Release({}, runners)

    expect(result.status).toBe('skipped')
    expect(result.reason).toContain('Generated release registry is absent')
    expect(runners.runP1ReleaseReadiness).not.toHaveBeenCalled()
    expect(runners.packageRelease).not.toHaveBeenCalled()
    expect(renderCiOptionalP1Release(result)).toContain(
      '# CI Optional P1 Release Package: SKIPPED',
    )
  })

  it('runs readiness, package, and validation when generated packs are present', async () => {
    const runners = makeRunners()

    const result = await runCiOptionalP1Release({}, runners)

    expect(result.status).toBe('passed')
    const readinessCall = vi.mocked(runners.runP1ReleaseReadiness).mock.calls[0]?.[0]
    expect(readinessCall).toMatchObject({
      districtId: 'xinyi',
      root: 'public/data/generated',
    })
    expect(readinessCall?.registryPath?.replace(/\\/g, '/')).toBe(
      'public/data/generated/registry.json',
    )
    expect(runners.packageRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        includeGlob: 'public/data/generated/xinyi/**',
        districtIds: ['xinyi'],
      }),
    )
    expect(runners.validateReleasePackage).toHaveBeenCalledWith({
      zipPath: releasePackagePass.zipPath,
      manifestPath: releasePackagePass.manifestPath,
      districtIds: ['xinyi'],
    })
  })

  it('fails when readiness is blocked', async () => {
    const runners = makeRunners({
      runP1ReleaseReadiness: vi.fn().mockResolvedValue(readinessBlocked),
    })

    const result = await runCiOptionalP1Release({}, runners)

    expect(result.status).toBe('failed')
    expect(result.errors).toEqual(['P0 readiness: failed'])
    expect(runners.packageRelease).not.toHaveBeenCalled()
  })
})
