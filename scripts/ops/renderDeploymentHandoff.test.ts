import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildRenderDeploymentHandoff,
  normalizeRepository,
  parseRenderDeploymentHandoffArgs,
  renderRenderDeploymentHandoff,
  writeRenderDeploymentHandoffOutputs,
} from './renderDeploymentHandoff'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

describe('renderDeploymentHandoff', () => {
  it('parses CLI args', () => {
    expect(
      parseRenderDeploymentHandoffArgs([
        'node',
        'renderDeploymentHandoff.ts',
        '--repository',
        'owner/repo',
        '--tag',
        'data-release',
        '--out',
        '.tmp/handoff.md',
        '--json-out',
        '.tmp/handoff.json',
        '--handoff-asset-dir',
        '.tmp/handoff-assets',
      ]),
    ).toMatchObject({
      repository: 'owner/repo',
      tagInput: 'data-release',
      outPath: '.tmp/handoff.md',
      jsonOutPath: '.tmp/handoff.json',
      handoffAssetDir: '.tmp/handoff-assets',
    })
  })

  it('normalizes GitHub repository values', () => {
    expect(normalizeRepository('owner/repo')).toBe('owner/repo')
    expect(normalizeRepository('https://github.com/owner/repo.git')).toBe('owner/repo')
    expect(normalizeRepository('git@github.com:owner/repo.git')).toBe('owner/repo')
    expect(normalizeRepository('not a repo')).toBeNull()
  })

  it('builds a ready handoff from P3 and deploy readiness artifacts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-handoff-'))
    const p3Json = path.join(base, 'p3.json')
    const deployJson = path.join(base, 'deploy.json')
    const zipPath = path.join(base, 'release.zip')
    const manifestPath = path.join(base, 'release.json')
    const handoffAssetDir = path.join(base, 'handoff-assets')
    await fs.writeFile(zipPath, 'zip')
    await fs.writeFile(manifestPath, '{}')
    await writeJson(p3Json, {
      pass: true,
      inputs: {
        districtIds: ['xinyi', 'daan'],
      },
      releasePackage: {
        summary: {
          releaseId: '20260529_abcd123',
          districtIds: ['daan', 'xinyi'],
          fileCount: 10,
          totalBytes: 1000,
        },
      },
    })
    await writeJson(deployJson, {
      pass: true,
      release: {
        releaseId: '20260529_abcd123',
        zipPath,
        manifestPath,
      },
      install: {
        result: {
          fileCount: 10,
        },
      },
      parkingAnswerApis: {
        pass: true,
      },
      appServer: {
        pass: true,
      },
      generatedPacks: {
        result: {
          packResults: [
            {
              districtId: 'daan',
              parkingSummary: {
                datasetHash: 'hash-daan',
              },
            },
            {
              districtId: 'xinyi',
              parkingSummary: {
                datasetHash: 'hash-xinyi',
              },
            },
          ],
        },
      },
    })

    const result = await buildRenderDeploymentHandoff({
      p3ReadinessJsonPath: p3Json,
      deployReadinessJsonPath: deployJson,
      handoffAssetDir,
      repository: 'owner/repo',
    })

    expect(result.ready).toBe(true)
    expect(result.packageUrl).toBe(
      'https://github.com/owner/repo/releases/download/data-20260529_abcd123/park-king-data_20260529_abcd123.zip',
    )
    expect(result.renderEnv).toMatchObject({
      PARKKING_RELEASE_PACKAGE_URL:
        'https://github.com/owner/repo/releases/download/data-20260529_abcd123/park-king-data_20260529_abcd123.zip',
      PARKKING_RELEASE_MANIFEST_URL:
        'https://github.com/owner/repo/releases/download/data-20260529_abcd123/release_manifest_20260529_abcd123.json',
      PARKKING_SYNC_CORS_ORIGINS: 'https://parkking.onrender.com',
      PARKKING_GEOCODER_REQUEST_TIMEOUT_MS: '5000',
      PARKKING_ROUTING_REQUEST_TIMEOUT_MS: '8000',
    })
    expect(result.releaseAssetPaths).toEqual([
      path.join(handoffAssetDir, '20260529_abcd123', 'park-king-data_20260529_abcd123.zip'),
      path.join(handoffAssetDir, '20260529_abcd123', 'release_manifest_20260529_abcd123.json'),
    ])
    await expect(fs.readFile(result.releaseAssetPaths[0], 'utf-8')).resolves.toBe('zip')
    await expect(fs.readFile(result.releaseAssetPaths[1], 'utf-8')).resolves.toBe('{}')
    await fs.rm(zipPath)
    await fs.rm(manifestPath)
    await expect(fs.readFile(result.releaseAssetPaths[0], 'utf-8')).resolves.toBe('zip')
    expect(renderRenderDeploymentHandoff(result)).toContain(
      '# Render Deployment Handoff: READY',
    )
    expect(result.expectedDatasets).toEqual([
      {
        districtId: 'daan',
        datasetHash: 'hash-daan',
      },
      {
        districtId: 'xinyi',
        datasetHash: 'hash-xinyi',
      },
    ])
    expect(renderRenderDeploymentHandoff(result)).toContain(
      'Expected datasets: daan:hash-daan, xinyi:hash-xinyi',
    )
    expect(result.externalSteps.join('\n')).toContain(
      'npm run ops:render-live-verify-dispatch',
    )
    expect(result.externalSteps.join('\n')).toContain(
      'GitHub Actions -> Render Live Verify',
    )
    expect(result.externalSteps.join('\n')).toContain(
      'use the package and manifest URLs printed by that workflow run',
    )
    expect(result.externalSteps.join('\n')).toContain(
      'Set Render environment variables exactly as listed',
    )
    expect(result.externalSteps.join('\n')).toContain(
      '--manifest-url https://github.com/owner/repo/releases/download/data-20260529_abcd123/release_manifest_20260529_abcd123.json',
    )
    expect(result.externalSteps.join('\n')).toContain(
      'skipSyncIssueRoundtrip=false unless',
    )
  })

  it('blocks when deploy readiness points at a different release', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-handoff-blocked-'))
    const p3Json = path.join(base, 'p3.json')
    const deployJson = path.join(base, 'deploy.json')
    const zipPath = path.join(base, 'release.zip')
    const manifestPath = path.join(base, 'release.json')
    await fs.writeFile(zipPath, 'zip')
    await fs.writeFile(manifestPath, '{}')
    await writeJson(p3Json, {
      pass: true,
      releasePackage: {
        summary: {
          releaseId: 'release-a',
        },
      },
    })
    await writeJson(deployJson, {
      pass: true,
      release: {
        releaseId: 'release-b',
        zipPath,
        manifestPath,
      },
      parkingAnswerApis: {
        pass: true,
      },
      appServer: {
        pass: true,
      },
    })

    const result = await buildRenderDeploymentHandoff({
      p3ReadinessJsonPath: p3Json,
      deployReadinessJsonPath: deployJson,
      repository: 'owner/repo',
    })

    expect(result.ready).toBe(false)
    expect(result.blockers.join('\n')).toContain(
      'does not match P3 release release-a',
    )
  })

  it('writes markdown and JSON handoff artifacts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-handoff-out-'))
    const result = {
      ready: true,
      repository: 'owner/repo',
      release: {
        releaseId: 'release-a',
        tag: 'data-release-a',
      },
      packageUrl:
        'https://github.com/owner/repo/releases/download/data-release-a/park-king-data_release-a.zip',
      manifestUrl:
        'https://github.com/owner/repo/releases/download/data-release-a/release_manifest_release-a.json',
      p3ReadinessPass: true,
      deployReadinessPass: true,
      districts: ['xinyi'],
      releaseFileCount: 1,
      releaseTotalBytes: 2,
      installedFileCount: 1,
      releaseAssetPaths: ['release.zip', 'release.json'],
      expectedDatasets: [{ districtId: 'xinyi', datasetHash: 'hash-xinyi' }],
      blockers: [],
      renderEnv: {
        PARKKING_RELEASE_PACKAGE_URL: 'package-url',
        PARKKING_RELEASE_MANIFEST_URL: 'manifest-url',
      },
      externalSteps: ['step one'],
    }
    const outPath = path.join(base, 'handoff.md')
    const jsonOutPath = path.join(base, 'handoff.json')
    await writeRenderDeploymentHandoffOutputs(result, { outPath, jsonOutPath })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '# Render Deployment Handoff: READY',
    )
    await expect(fs.readFile(jsonOutPath, 'utf-8')).resolves.toContain(
      '"ready": true',
    )
  })

  it('blocks stale handoff artifacts when local release assets are missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-handoff-stale-'))
    const p3Json = path.join(base, 'p3.json')
    const deployJson = path.join(base, 'deploy.json')
    await writeJson(p3Json, {
      pass: true,
      releasePackage: {
        summary: {
          releaseId: 'release-a',
        },
      },
    })
    await writeJson(deployJson, {
      pass: true,
      release: {
        releaseId: 'release-a',
        zipPath: path.join(base, 'missing.zip'),
        manifestPath: path.join(base, 'missing.json'),
      },
      parkingAnswerApis: {
        pass: true,
      },
      appServer: {
        pass: true,
      },
    })

    const result = await buildRenderDeploymentHandoff({
      p3ReadinessJsonPath: p3Json,
      deployReadinessJsonPath: deployJson,
      repository: 'owner/repo',
    })

    expect(result.ready).toBe(false)
    expect(result.blockers.join('\n')).toContain('Release assets are missing locally')
  })
})
