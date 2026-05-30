import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import { buildReleaseManifest } from './packageReleaseArchive'
import { sha256Buffer } from './packageReleaseUtils'
import {
  buildDownloadHeaders,
  extractReleasePackage,
  installReleasePackage,
  normalizeZipEntryPath,
  parseInstallReleasePackageArgs,
  validateInstalledRelease,
} from './installReleasePackage'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const createReleaseZip = async (base: string) => {
  const releaseDir = path.join(base, 'release')
  const zipPath = path.join(releaseDir, 'park-king-data_test.zip')
  const manifestPath = path.join(releaseDir, 'release_manifest_test.json')
  const files = new Map<string, Buffer>([
    [
      'registry.json',
      Buffer.from(
        JSON.stringify({
          districts: [
            {
              districtId: 'xinyi',
              latest: { datasetHash: 'hash-a', publishedAt: '2026-05-01T00:00:00Z' },
            },
          ],
        }),
      ),
    ],
    [
      'xinyi/LATEST.json',
      Buffer.from(
        JSON.stringify({
          datasetHash: 'hash-a',
          publishedAt: '2026-05-01T00:00:00Z',
        }),
      ),
    ],
    [
      'xinyi/dataset_meta.json',
      Buffer.from(JSON.stringify({ districtId: 'xinyi', datasetHash: 'hash-a' })),
    ],
  ])
  const zip = new AdmZip()
  const manifestEntries = [...files.entries()].map(([entryPath, buffer]) => {
    zip.addFile(entryPath, buffer)
    return {
      path: entryPath,
      sha256: sha256Buffer(buffer),
      bytes: buffer.length,
    }
  })
  await fs.mkdir(releaseDir, { recursive: true })
  zip.writeZip(zipPath)
  await writeJson(
    manifestPath,
    buildReleaseManifest({
      releaseId: 'test',
      baseDir: path.join(base, 'public', 'data', 'generated'),
      manifestEntries,
      districts: [
        {
          districtId: 'xinyi',
          datasetHash: 'hash-a',
          publishedAt: '2026-05-01T00:00:00Z',
        },
      ],
      cwd: base,
    }),
  )
  return { zipPath, manifestPath }
}

describe('installReleasePackage', () => {
  it('installs and validates a release package with its manifest', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'install-release-'))
    const { zipPath, manifestPath } = await createReleaseZip(base)
    const outRoot = path.join(base, 'public', 'data', 'generated')

    const result = await installReleasePackage({
      zipPath,
      manifestPath,
      outRoot,
      requireManifest: true,
    })

    expect(result.manifestValidation?.pass).toBe(true)
    expect(result.registryDistrictIds).toEqual(['xinyi'])
    await expect(
      fs.readFile(path.join(outRoot, 'xinyi', 'dataset_meta.json'), 'utf-8'),
    ).resolves.toContain('xinyi')
  })

  it('rejects unsafe zip entry paths before extraction', () => {
    expect(() => normalizeZipEntryPath('../evil.txt')).toThrow(
      'Unsafe release package entry path',
    )
    expect(() => normalizeZipEntryPath('xinyi/../../evil.txt')).toThrow(
      'Unsafe release package entry path',
    )
    expect(() => normalizeZipEntryPath('C:/evil.txt')).toThrow(
      'Unsafe release package entry path',
    )
  })

  it('refuses to clean non-generated output roots', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'install-release-root-'))
    const zipPath = path.join(base, 'release.zip')
    const zip = new AdmZip()
    zip.addFile('registry.json', Buffer.from('{"districts":[]}'))
    zip.writeZip(zipPath)

    await expect(
      extractReleasePackage({
        zipPath,
        outRoot: path.join(base, 'public'),
      }),
    ).rejects.toThrow('Refusing to clean non-generated release output root')
  })

  it('can validate existing data when package installation is intentionally skipped', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'install-release-existing-'))
    const outRoot = path.join(base, 'public', 'data', 'generated')
    await writeJson(path.join(outRoot, 'registry.json'), {
      districts: [{ districtId: 'xinyi' }],
    })
    await writeJson(path.join(outRoot, 'xinyi', 'LATEST.json'), {
      datasetHash: 'hash-a',
    })
    await writeJson(path.join(outRoot, 'xinyi', 'dataset_meta.json'), {
      districtId: 'xinyi',
    })

    await expect(validateInstalledRelease(outRoot)).resolves.toMatchObject({
      registryDistrictIds: ['xinyi'],
    })
    await expect(
      installReleasePackage({ outRoot, allowExisting: true }),
    ).resolves.toMatchObject({
      source: 'existing',
      extractedFiles: 0,
      registryDistrictIds: ['xinyi'],
    })
  })

  it('parses deployment env and strict manifest flags', () => {
    const previousPackageUrl = process.env.PARKKING_RELEASE_PACKAGE_URL
    const previousManifestUrl = process.env.PARKKING_RELEASE_MANIFEST_URL
    const previousDownloadToken = process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN
    process.env.PARKKING_RELEASE_PACKAGE_URL = 'https://example.test/data.zip'
    process.env.PARKKING_RELEASE_MANIFEST_URL = 'https://example.test/manifest.json'
    process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN = 'token-a'

    try {
      expect(
        parseInstallReleasePackageArgs([
          'node',
          'installReleasePackage.ts',
          '--require-manifest',
          '--district',
          'xinyi,daan',
        ]),
      ).toMatchObject({
        url: 'https://example.test/data.zip',
        manifestUrl: 'https://example.test/manifest.json',
        downloadToken: 'token-a',
        requireManifest: true,
        districtIds: ['xinyi', 'daan'],
      })
    } finally {
      if (previousPackageUrl === undefined) {
        delete process.env.PARKKING_RELEASE_PACKAGE_URL
      } else {
        process.env.PARKKING_RELEASE_PACKAGE_URL = previousPackageUrl
      }
      if (previousManifestUrl === undefined) {
        delete process.env.PARKKING_RELEASE_MANIFEST_URL
      } else {
        process.env.PARKKING_RELEASE_MANIFEST_URL = previousManifestUrl
      }
      if (previousDownloadToken === undefined) {
        delete process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN
      } else {
        process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN = previousDownloadToken
      }
    }
  })

  it('builds authenticated download headers when release assets are private', () => {
    expect(buildDownloadHeaders({ downloadToken: 'token-a' })).toMatchObject({
      authorization: 'Bearer token-a',
    })
    expect(
      buildDownloadHeaders({
        downloadToken: 'token-a',
        downloadAuthHeader: 'token token-b',
      }),
    ).toMatchObject({
      authorization: 'token token-b',
    })
  })
})
