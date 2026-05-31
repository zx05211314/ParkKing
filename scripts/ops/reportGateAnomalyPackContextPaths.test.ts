import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { resolveGateAnomalyPackPaths } from './reportGateAnomalyPackContextPaths'

describe('reportGateAnomalyPackContextPaths', () => {
  it('keeps the current pack when diff nextPath points at a stale missing pack', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'gate-anomaly-paths-'))
    const prevDir = path.join(baseDir, 'prev')
    const nextDir = path.join(baseDir, 'next')
    await fs.mkdir(prevDir, { recursive: true })
    await fs.mkdir(nextDir, { recursive: true })

    await fs.writeFile(
      path.join(prevDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(nextDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(nextDir, 'diff_report.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: '2026-03-02T00:00:00.000Z',
          prevPath: prevDir,
          nextPath: path.join(baseDir, 'missing-next-pack'),
          firstPublish: false,
          summary: {
            districtsAdded: [],
            districtsRemoved: [],
            totalChangedFiles: 1,
          },
          districts: [],
        },
        null,
        2,
      ),
      'utf-8',
    )

    const resolved = await resolveGateAnomalyPackPaths({
      districtId: 'xinyi',
      packPath: nextDir,
      outPath: path.join(baseDir, 'reports', 'xinyi.json'),
    })

    expect(resolved.packPath).toBe(path.resolve(nextDir))
    expect(resolved.outPath).toBe(path.resolve(baseDir, 'reports', 'xinyi.json'))
    expect(resolved.prevPackPath).toBe(path.resolve(prevDir))
    expect(resolved.nextPackPath).toBe(path.resolve(nextDir))
    expect(resolved.diffReportPath).toBe(path.resolve(nextDir, 'diff_report.json'))
  })
})
