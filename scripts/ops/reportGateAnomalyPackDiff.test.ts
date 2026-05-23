import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { resolveDiffReport } from './reportGateAnomalyPackDiff'

describe('reportGateAnomalyPackDiff', () => {
  it('loads an existing diff report from the pack directory', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'report-gate-pack-diff-'))
    const pack = path.join(root, 'xinyi')
    await fs.mkdir(pack, { recursive: true })
    await fs.writeFile(
      path.join(pack, 'diff_report.json'),
      JSON.stringify({ schemaVersion: 1, districts: [] }),
      'utf-8',
    )

    await expect(resolveDiffReport('xinyi', pack)).resolves.toMatchObject({
      path: path.resolve(pack, 'diff_report.json'),
      report: {
        schemaVersion: 1,
        districts: [],
      },
    })
  })
})
