import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkStaticDataParity,
  parseDeployReadinessArgs,
  renderDeployReadiness,
  runDeployReadiness,
  writeDeployReadinessOutputs,
  type DeployReadinessRunners,
} from './deployReadiness'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const writePackPointer = async (
  root: string,
  districtId: string,
  datasetHash: string,
) => {
  await writeJson(path.join(root, 'registry.json'), {
    districts: [{ districtId }],
  })
  await writeJson(path.join(root, districtId, 'LATEST.json'), {
    datasetHash,
  })
}

describe('deployReadiness', () => {
  const envSnapshot: Record<string, string | undefined> = {}

  beforeEach(() => {
    envSnapshot.PARKKING_APP_STATIC_DIR = process.env.PARKKING_APP_STATIC_DIR
    envSnapshot.PARKKING_PARKING_ANSWER_DATASET_ROOT =
      process.env.PARKKING_PARKING_ANSWER_DATASET_ROOT
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('parses deployment readiness args', () => {
    expect(
      parseDeployReadinessArgs([
        'node',
        'deployReadiness.ts',
        '--release-dir',
        'dist/releases',
        '--install-root',
        '.tmp/deploy',
        '--static-dir',
        'dist',
        '--timeout-ms',
        '1234',
        '--max-cases',
        '2',
        '--skip-app-smoke',
      ]),
    ).toMatchObject({
      outDir: 'dist/releases',
      installRoot: '.tmp/deploy',
      staticDir: 'dist',
      timeoutMs: 1234,
      maxCases: 2,
      skipAppSmoke: true,
    })
  })

  it('checks static data parity by district and dataset hash', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'deploy-parity-'))
    const installedRoot = path.join(base, 'installed')
    const staticRoot = path.join(base, 'dist', 'data', 'generated')
    await writePackPointer(installedRoot, 'xinyi', 'hash-a')
    await writePackPointer(staticRoot, 'xinyi', 'hash-a')

    await expect(
      checkStaticDataParity({
        installedRoot,
        staticDir: path.join(base, 'dist'),
      }),
    ).resolves.toMatchObject({
      pass: true,
      checkedDistricts: ['xinyi'],
    })

    await writeJson(path.join(staticRoot, 'xinyi', 'LATEST.json'), {
      datasetHash: 'hash-b',
    })

    const mismatch = await checkStaticDataParity({
      installedRoot,
      staticDir: path.join(base, 'dist'),
    })
    expect(mismatch.pass).toBe(false)
    expect(mismatch.errors.join('\n')).toContain(
      'does not match installed release hash-a',
    )
  })

  it('runs deploy checks against an installed release and restores env', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'deploy-readiness-'))
    const installRoot = path.join(base, 'installed')
    const staticDir = path.join(base, 'dist')
    const staticRoot = path.join(staticDir, 'data', 'generated')
    await writePackPointer(staticRoot, 'xinyi', 'hash-a')

    process.env.PARKKING_APP_STATIC_DIR = 'previous-static'
    process.env.PARKKING_PARKING_ANSWER_DATASET_ROOT = 'previous-data'

    let appSmokeEnv: Record<string, string | undefined> = {}
    const runners: DeployReadinessRunners = {
      resolveReleasePackagePaths: async () => ({
        releaseId: 'release-1',
        zipPath: path.join(base, 'release.zip'),
        manifestPath: path.join(base, 'release.json'),
      }),
      installReleasePackage: async (args) => {
        await writePackPointer(args.outRoot ?? installRoot, 'xinyi', 'hash-a')
        return {
          source: args.zipPath ?? 'release.zip',
          manifestSource: args.manifestPath ?? null,
          outRoot: args.outRoot ?? installRoot,
          registryDistrictIds: ['xinyi'],
          fileCount: 3,
          extractedFiles: 3,
          manifestValidation: null,
        }
      },
      runSmokeGeneratedPacks: async (options) => ({
        root: options.root ?? '',
        registryPath: options.registryPath ?? null,
        reportPath: null,
        packResults: [],
        errors: [],
        hasErrors: false,
      }),
      runSmokeParkingAnswerServices: async (options) => ({
        root: options.root ?? '',
        registryPath: options.registryPath ?? null,
        reportPath: null,
        packResults: [],
        errors: [],
        hasErrors: false,
      }),
      runSmokeAppServer: async () => {
        appSmokeEnv = {
          PARKKING_APP_STATIC_DIR: process.env.PARKKING_APP_STATIC_DIR,
          PARKKING_PARKING_ANSWER_DATASET_ROOT:
            process.env.PARKKING_PARKING_ANSWER_DATASET_ROOT,
        }
        return {
          pass: true,
          baseUrl: 'http://127.0.0.1:1',
          probes: [],
        }
      },
    }

    const result = await runDeployReadiness(
      {
        installRoot,
        staticDir,
        timeoutMs: 1000,
      },
      runners,
    )

    expect(result.pass).toBe(true)
    expect(appSmokeEnv).toEqual({
      PARKKING_APP_STATIC_DIR: path.resolve(staticDir),
      PARKKING_PARKING_ANSWER_DATASET_ROOT: path.resolve(installRoot),
    })
    expect(process.env.PARKKING_APP_STATIC_DIR).toBe('previous-static')
    expect(process.env.PARKKING_PARKING_ANSWER_DATASET_ROOT).toBe('previous-data')
    expect(renderDeployReadiness(result)).toContain('# Deploy Readiness: PASS')
  })

  it('writes markdown and JSON deployment readiness artifacts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'deploy-readiness-out-'))
    const installRoot = path.join(base, 'installed')
    const staticDir = path.join(base, 'dist')
    const staticRoot = path.join(staticDir, 'data', 'generated')
    await writePackPointer(staticRoot, 'xinyi', 'hash-a')

    const runners: DeployReadinessRunners = {
      resolveReleasePackagePaths: async () => ({
        releaseId: 'release-1',
        zipPath: path.join(base, 'release.zip'),
        manifestPath: path.join(base, 'release.json'),
      }),
      installReleasePackage: async (args) => {
        await writePackPointer(args.outRoot ?? installRoot, 'xinyi', 'hash-a')
        return {
          source: args.zipPath ?? 'release.zip',
          manifestSource: args.manifestPath ?? null,
          outRoot: args.outRoot ?? installRoot,
          registryDistrictIds: ['xinyi'],
          fileCount: 3,
          extractedFiles: 3,
          manifestValidation: null,
        }
      },
      runSmokeGeneratedPacks: async () => ({
        root: installRoot,
        registryPath: path.join(installRoot, 'registry.json'),
        reportPath: null,
        packResults: [],
        errors: [],
        hasErrors: false,
      }),
      runSmokeParkingAnswerServices: async () => ({
        root: installRoot,
        registryPath: path.join(installRoot, 'registry.json'),
        reportPath: null,
        packResults: [],
        errors: [],
        hasErrors: false,
      }),
      runSmokeAppServer: async () => ({
        pass: true,
        baseUrl: 'http://127.0.0.1:1',
        probes: [],
      }),
    }

    const result = await runDeployReadiness({ installRoot, staticDir }, runners)
    const outPath = path.join(base, 'deploy.md')
    const jsonOutPath = path.join(base, 'deploy.json')
    await writeDeployReadinessOutputs(result, { outPath, jsonOutPath })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '# Deploy Readiness: PASS',
    )
    await expect(fs.readFile(jsonOutPath, 'utf-8')).resolves.toContain(
      '"pass": true',
    )
  })
})
