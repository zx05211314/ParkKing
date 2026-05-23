import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { collectOptionalReleaseFiles } from './packageReleaseOptionalFiles'

describe('packageReleaseOptionalFiles', () => {
  it('returns only optional ops files that exist', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'release-optional-'))
    await fs.mkdir(path.join(baseDir, '_ops'), { recursive: true })
    await fs.writeFile(path.join(baseDir, 'ingest_all_report.json'), '{}', 'utf-8')
    await fs.writeFile(path.join(baseDir, '_ops', 'publish_gate_summary.md'), '# summary', 'utf-8')

    const files = await collectOptionalReleaseFiles(baseDir)
    const relativePaths = files.map((file) => path.relative(baseDir, file).replace(/\\/g, '/'))

    expect(relativePaths).toEqual([
      'ingest_all_report.json',
      '_ops/publish_gate_summary.md',
    ])
  })
})
