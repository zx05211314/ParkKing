import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { packageRelease } from './packageRelease'
import {
  findLatestReleasePackage,
  parseValidateReleasePackageArgs,
  renderValidateReleasePackageResult,
  validateReleasePackage,
  writeValidateReleasePackageOutputs,
} from './validateReleasePackage'

const writeFixtureRegistry = async (baseDir: string) => {
  await fs.mkdir(path.join(baseDir, 'xinyi'), { recursive: true })
  await fs.mkdir(path.join(baseDir, 'daan'), { recursive: true })
  await fs.writeFile(path.join(baseDir, 'xinyi', 'red_yellow.geojson'), '{}', 'utf-8')
  await fs.writeFile(path.join(baseDir, 'daan', 'red_yellow.geojson'), '{}', 'utf-8')
  await fs.writeFile(path.join(baseDir, 'ingest_all_report.json'), '{}', 'utf-8')
  await fs.mkdir(path.join(baseDir, '_ops'), { recursive: true })
  await fs.writeFile(
    path.join(baseDir, '_ops', 'publish_gate_summary.json'),
    '{}',
    'utf-8',
  )
  await fs.writeFile(
    path.join(baseDir, '_ops', 'publish_gate_summary.md'),
    '# ok\n',
    'utf-8',
  )
  const registryPath = path.join(baseDir, 'registry.json')
  await fs.writeFile(
    registryPath,
    JSON.stringify(
      {
        generatedAt: '2026-05-23T00:00:00.000Z',
        districts: [
          {
            districtId: 'xinyi',
            latest: {
              datasetHash: 'hash-a',
              publishedAt: '2026-05-23T00:00:00.000Z',
            },
          },
          {
            districtId: 'daan',
            latest: {
              datasetHash: 'hash-b',
              publishedAt: '2026-05-23T00:00:00.000Z',
            },
          },
        ],
      },
      null,
      2,
    ),
    'utf-8',
  )
  return registryPath
}

describe('validateReleasePackage', () => {
  it('parses release validation args', () => {
    expect(
      parseValidateReleasePackageArgs([
        'node',
        'validateReleasePackage',
        '--out-dir',
        'dist/releases',
        '--zip',
        'dist/releases/park-king-data_1.zip',
        '--manifest',
        'dist/releases/release_manifest_1.json',
        '--district',
        'xinyi,daan',
        '--out',
        '.tmp/release.md',
        '--json-out',
        '.tmp/release.json',
      ]),
    ).toEqual({
      outDir: 'dist/releases',
      zipPath: 'dist/releases/park-king-data_1.zip',
      manifestPath: 'dist/releases/release_manifest_1.json',
      districtIds: ['xinyi', 'daan'],
      outPath: '.tmp/release.md',
      jsonOutPath: '.tmp/release.json',
    })
  })

  it('passes for a district-scoped release archive', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'validate-release-pass-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    const registryPath = await writeFixtureRegistry(baseDir)
    const release = await packageRelease({
      outDir: path.join(base, 'releases'),
      registryPath,
      includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
      districtIds: ['xinyi'],
    })

    const result = await validateReleasePackage({
      zipPath: release.zipPath,
      manifestPath: release.manifestPath,
      districtIds: ['xinyi'],
    })

    expect(result.pass).toBe(true)
    expect(result.registryDistrictIds).toEqual(['xinyi'])
    expect(result.errors).toEqual([])
  })

  it('fails when a district-scoped validation sees unreviewed district files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'validate-release-fail-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    const registryPath = await writeFixtureRegistry(baseDir)
    const release = await packageRelease({
      outDir: path.join(base, 'releases'),
      registryPath,
      includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
    })

    const result = await validateReleasePackage({
      zipPath: release.zipPath,
      manifestPath: release.manifestPath,
      districtIds: ['xinyi'],
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'registry districts xinyi, daan do not match expected xinyi',
    )
    expect(result.errors).toContain(
      'district-scoped release contains unexpected file: daan/red_yellow.geojson',
    )
  })

  it('finds the latest release zip and manifest pair', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'validate-release-latest-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    const registryPath = await writeFixtureRegistry(baseDir)
    const release = await packageRelease({
      outDir: path.join(base, 'releases'),
      registryPath,
      includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
      districtIds: ['xinyi'],
    })

    const latest = await findLatestReleasePackage(path.join(base, 'releases'))

    expect(latest.zipPath).toBe(release.zipPath)
    expect(latest.manifestPath).toBe(release.manifestPath)
    expect(latest.releaseId).toBe(release.releaseId)
  })

  it('renders a concise validation result', () => {
    const output = renderValidateReleasePackageResult({
      releaseId: 'release-1',
      zipPath: 'dist/releases/park-king-data_release-1.zip',
      manifestPath: 'dist/releases/release_manifest_release-1.json',
      pass: false,
      expectedDistrictIds: ['xinyi'],
      registryDistrictIds: ['xinyi', 'daan'],
      fileCount: 2,
      totalBytes: 100,
      errors: ['district-scoped release contains unexpected file: daan/file.json'],
    })

    expect(output).toContain('# Validate Release Package: FAIL')
    expect(output).toContain('- Expected districts: xinyi')
    expect(output).toContain('- Registry districts: xinyi, daan')
    expect(output).toContain(
      '- district-scoped release contains unexpected file: daan/file.json',
    )
  })

  it('writes markdown and JSON validation outputs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'validate-release-output-'))
    const result = {
      releaseId: 'release-1',
      zipPath: 'dist/releases/park-king-data_release-1.zip',
      manifestPath: 'dist/releases/release_manifest_release-1.json',
      pass: true,
      expectedDistrictIds: ['xinyi'],
      registryDistrictIds: ['xinyi'],
      fileCount: 2,
      totalBytes: 100,
      errors: [],
    }
    const outPath = path.join(base, 'release.md')
    const jsonOutPath = path.join(base, 'release.json')

    await writeValidateReleasePackageOutputs(result, { outPath, jsonOutPath })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '# Validate Release Package: PASS',
    )
    await expect(fs.readFile(jsonOutPath, 'utf-8')).resolves.toContain(
      '"pass": true',
    )
  })
})
