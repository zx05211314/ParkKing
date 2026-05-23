import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { listZipFiles } from './unpackSourceDiscovery'

describe('unpackSourceDiscovery', () => {
  it('lists only zip files from the source root in sorted order', async () => {
    const sourceRoot = await fs.mkdtemp(path.join(tmpdir(), 'unpack-discovery-'))
    await fs.writeFile(path.join(sourceRoot, 'b.zip'), 'b', 'utf-8')
    await fs.writeFile(path.join(sourceRoot, 'a.ZIP'), 'a', 'utf-8')
    await fs.writeFile(path.join(sourceRoot, 'note.txt'), 'x', 'utf-8')
    await fs.mkdir(path.join(sourceRoot, 'subdir'), { recursive: true })

    await expect(listZipFiles(sourceRoot)).resolves.toEqual([
      path.resolve(sourceRoot, 'a.ZIP'),
      path.resolve(sourceRoot, 'b.zip'),
    ])
  })
})
