import { describe, expect, it } from 'vitest'
import { buildReleaseManifest } from './packageReleaseArchive'

describe('buildReleaseManifest', () => {
  it('sorts manifest entries by relative path', () => {
    const manifest = buildReleaseManifest({
      releaseId: 'release-1',
      baseDir: 'C:\\repo\\public\\data\\generated',
      cwd: 'C:\\repo',
      manifestEntries: [
        { path: 'z/file.json', sha256: 'z', bytes: 1 },
        { path: 'a/file.json', sha256: 'a', bytes: 2 },
      ],
    })

    expect(manifest.releaseId).toBe('release-1')
    expect(manifest.baseDir).toBe('public\\data\\generated')
    expect(manifest.files.map((entry) => entry.path)).toEqual([
      'a/file.json',
      'z/file.json',
    ])
  })
})
