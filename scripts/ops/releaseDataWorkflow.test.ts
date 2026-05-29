import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildReleaseDataUrls,
  resolveReleaseDataMetadata,
} from './releaseDataWorkflow'

describe('releaseDataWorkflow', () => {
  it('resolves release metadata from p3 readiness output', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-data-meta-'))
    const readinessJsonPath = path.join(base, 'p3.json')
    await fs.writeFile(
      readinessJsonPath,
      JSON.stringify({
        releasePackage: {
          summary: {
            releaseId: '20260529_abcd123',
          },
        },
      }),
      'utf-8',
    )

    await expect(
      resolveReleaseDataMetadata({ readinessJsonPath }),
    ).resolves.toEqual({
      releaseId: '20260529_abcd123',
      tag: 'data-20260529_abcd123',
    })
  })

  it('builds deterministic GitHub release asset URLs', () => {
    expect(
      buildReleaseDataUrls({
        repository: 'owner/repo',
        tag: 'data-release',
        releaseId: '20260529_abcd123',
      }),
    ).toEqual({
      packageUrl:
        'https://github.com/owner/repo/releases/download/data-release/park-king-data_20260529_abcd123.zip',
      manifestUrl:
        'https://github.com/owner/repo/releases/download/data-release/release_manifest_20260529_abcd123.json',
    })
  })
})
