import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import { collectReleaseFiles, packageRelease, renderPackageReleaseResult } from './packageRelease'

describe('packageRelease', () => {
  it('collects registry, latest, and manifest files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-test-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    await fs.mkdir(baseDir, { recursive: true })

    const registry = {
      generatedAt: new Date().toISOString(),
      districts: [
        {
          districtId: 'xinyi',
          latest: { datasetHash: 'hash-a', publishedAt: '2026-02-04T00:00:00Z' },
        },
      ],
    }
    const registryPath = path.join(baseDir, 'registry.json')
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8')

    const districtDir = path.join(baseDir, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(path.join(districtDir, 'red_yellow.geojson'), '{"type":"FeatureCollection","features":[]}')

    const manifestDir = path.join(baseDir, '_ops', 'manifests', 'xinyi')
    await fs.mkdir(manifestDir, { recursive: true })
    const manifestPath = path.join(manifestDir, '20260204T000000Z_hash-a.json')
    await fs.writeFile(manifestPath, '{"ok":true}', 'utf-8')

    const latest = {
      datasetHash: 'hash-a',
      publishedAt: '2026-02-04T00:00:00Z',
      manifestPath: '_ops/manifests/xinyi/20260204T000000Z_hash-a.json',
    }
    await fs.writeFile(
      path.join(districtDir, 'LATEST.json'),
      JSON.stringify(latest, null, 2),
      'utf-8',
    )

    const result = await collectReleaseFiles({
      registryPath,
      includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
    })

    const paths = result.files.map((file) => path.relative(baseDir, file).replace(/\\/g, '/'))
    expect(paths).toContain('registry.json')
    expect(paths).toContain('xinyi/LATEST.json')
    expect(paths).toContain('_ops/manifests/xinyi/20260204T000000Z_hash-a.json')
  })

  it('can scope included release files to selected districts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-district-test-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    await fs.mkdir(baseDir, { recursive: true })

    const registry = {
      generatedAt: new Date().toISOString(),
      districts: [
        {
          districtId: 'xinyi',
          latest: { datasetHash: 'hash-a', publishedAt: '2026-02-04T00:00:00Z' },
        },
        {
          districtId: 'daan',
          latest: { datasetHash: 'hash-b', publishedAt: '2026-02-05T00:00:00Z' },
        },
      ],
    }
    const registryPath = path.join(baseDir, 'registry.json')
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8')

    await fs.mkdir(path.join(baseDir, 'xinyi'), { recursive: true })
    await fs.mkdir(path.join(baseDir, 'daan'), { recursive: true })
    await fs.writeFile(path.join(baseDir, 'xinyi', 'red_yellow.geojson'), '{}', 'utf-8')
    await fs.writeFile(path.join(baseDir, 'daan', 'red_yellow.geojson'), '{}', 'utf-8')

    const result = await collectReleaseFiles({
      registryPath,
      includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
      districtIds: ['xinyi'],
    })

    const paths = result.files.map((file) => path.relative(baseDir, file).replace(/\\/g, '/'))
    expect(paths).toContain('registry.json')
    expect(paths).toContain('xinyi/red_yellow.geojson')
    expect(paths).not.toContain('daan/red_yellow.geojson')
  })

  it('writes a scoped registry into district-scoped release archives', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-scoped-registry-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    await fs.mkdir(path.join(baseDir, 'xinyi'), { recursive: true })
    await fs.mkdir(path.join(baseDir, 'daan'), { recursive: true })

    const registry = {
      generatedAt: '2026-05-23T00:00:00.000Z',
      districts: [
        {
          districtId: 'xinyi',
          latest: { datasetHash: 'hash-a', publishedAt: '2026-02-04T00:00:00Z' },
        },
        {
          districtId: 'daan',
          latest: { datasetHash: 'hash-b', publishedAt: '2026-02-05T00:00:00Z' },
        },
      ],
    }
    const registryPath = path.join(baseDir, 'registry.json')
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8')
    await fs.writeFile(path.join(baseDir, 'xinyi', 'red_yellow.geojson'), '{}', 'utf-8')
    await fs.writeFile(path.join(baseDir, 'daan', 'red_yellow.geojson'), '{}', 'utf-8')

    const result = await packageRelease({
      outDir: path.join(base, 'releases'),
      registryPath,
      includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
      districtIds: ['xinyi'],
    })

    const zip = new AdmZip(result.zipPath)
    const registryEntry = zip.getEntry('registry.json')
    expect(registryEntry).toBeTruthy()
    const scopedRegistry = JSON.parse(registryEntry?.getData().toString('utf-8') ?? '{}') as {
      districts: Array<{ districtId: string }>
    }

    expect(scopedRegistry.districts.map((district) => district.districtId)).toEqual(['xinyi'])
    expect(zip.getEntry('xinyi/red_yellow.geojson')).toBeTruthy()
    expect(zip.getEntry('daan/red_yellow.geojson')).toBeNull()
  })

  it('fails district-scoped release packaging for districts missing from registry', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-missing-district-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    await fs.mkdir(baseDir, { recursive: true })
    const registryPath = path.join(baseDir, 'registry.json')
    await fs.writeFile(
      registryPath,
      JSON.stringify({ districts: [{ districtId: 'xinyi' }] }, null, 2),
      'utf-8',
    )

    await expect(
      packageRelease({
        outDir: path.join(base, 'releases'),
        registryPath,
        includeGlob: `${baseDir.replace(/\\/g, '/')}/**/*.geojson`,
        districtIds: ['daan'],
      }),
    ).rejects.toThrow('Release package district not found in registry: daan')
  })

  it('renders package output with archive and manifest paths', () => {
    const output = renderPackageReleaseResult({
      releaseId: '20260523T000000Z_abcdef0',
      zipPath: 'dist/releases/park-king-data_20260523T000000Z_abcdef0.zip',
      manifestPath: 'dist/releases/release_manifest_20260523T000000Z_abcdef0.json',
      baseDir: 'public/data/generated',
      districtIds: ['xinyi'],
      fileCount: 3,
      totalBytes: 1234,
    })

    expect(output).toContain('# Release Package: PASS')
    expect(output).toContain('- Release ID: 20260523T000000Z_abcdef0')
    expect(output).toContain(
      '- Zip: dist/releases/park-king-data_20260523T000000Z_abcdef0.zip',
    )
    expect(output).toContain(
      '- Manifest: dist/releases/release_manifest_20260523T000000Z_abcdef0.json',
    )
    expect(output).toContain('- Districts: xinyi')
    expect(output).toContain('- Files: 3')
    expect(output).toContain('- Total bytes: 1234')
  })
})
