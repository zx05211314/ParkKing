import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadGateAnomalyPackContext } from './reportGateAnomalyPackContext'

describe('reportGateAnomalyPackContext', () => {
  it('loads pack metadata and falls back to the current pack when diff nextPath is stale', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'gate-anomaly-pack-'))
    const prevDir = path.join(baseDir, 'prev')
    const nextDir = path.join(baseDir, 'next')
    await fs.mkdir(prevDir, { recursive: true })
    await fs.mkdir(nextDir, { recursive: true })

    await fs.writeFile(
      path.join(prevDir, 'dataset_meta.json'),
      JSON.stringify(
        {
          districtId: 'xinyi',
          publishedAt: '2026-03-01T00:00:00.000Z',
        },
        null,
        2,
      ),
      'utf-8',
    )
    await fs.writeFile(
      path.join(nextDir, 'dataset_meta.json'),
      JSON.stringify(
        {
          districtId: 'xinyi',
          publishedAt: '2026-03-02T00:00:00.000Z',
        },
        null,
        2,
      ),
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
          districts: [
            {
              districtId: 'xinyi',
              status: 'UPDATED',
              severity: 'WARN',
              issues: [],
              meta: {},
              files: {
                added: [],
                removed: [],
                modified: [],
              },
            },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    )

    const context = await loadGateAnomalyPackContext({
      districtId: 'xinyi',
      packPath: nextDir,
      outPath: path.join(baseDir, 'reports', 'xinyi.json'),
    })

    expect(context.districtId).toBe('xinyi')
    expect(context.packPath).toBe(path.resolve(nextDir))
    expect(context.outPath).toBe(path.resolve(baseDir, 'reports', 'xinyi.json'))
    expect(context.prevPackPath).toBe(path.resolve(prevDir))
    expect(context.nextPackPath).toBe(path.resolve(nextDir))
    expect(context.prevPublishedAt).toBe('2026-03-01T00:00:00.000Z')
    expect(context.nextPublishedAt).toBe('2026-03-02T00:00:00.000Z')
    expect(context.prevDistrictIds).toEqual(['xinyi'])
    expect(context.nextDistrictIds).toEqual(['xinyi'])
    expect(context.districtDiff?.status).toBe('UPDATED')
  })
})
