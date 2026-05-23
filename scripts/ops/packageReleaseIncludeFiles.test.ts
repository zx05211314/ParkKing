import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { collectIncludedReleaseFiles } from './packageReleaseIncludeFiles'

describe('packageReleaseIncludeFiles', () => {
  it('excludes backup and staging matches from the include glob', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-include-'))
    const includeDir = path.join(base, 'public', 'data', 'generated')
    await fs.mkdir(path.join(includeDir, '.backup'), { recursive: true })
    await fs.mkdir(path.join(includeDir, '.staging'), { recursive: true })
    await fs.writeFile(path.join(includeDir, 'a.geojson'), '{}', 'utf-8')
    await fs.writeFile(path.join(includeDir, '.backup', 'b.geojson'), '{}', 'utf-8')
    await fs.writeFile(path.join(includeDir, '.staging', 'c.geojson'), '{}', 'utf-8')

    const files = await collectIncludedReleaseFiles(
      `${includeDir.replace(/\\/g, '/')}/**/*.geojson`,
    )
    const relativePaths = files.map((file) =>
      path.relative(includeDir, file).replace(/\\/g, '/'),
    )

    expect(relativePaths).toEqual(['a.geojson'])
  })
})
