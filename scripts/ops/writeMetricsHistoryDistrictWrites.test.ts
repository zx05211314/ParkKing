import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

import { writeMetricsHistoryDistricts } from './writeMetricsHistoryDistrictWrites'

const writeMeta = async (dir: string, meta: Record<string, unknown>) => {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'dataset_meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8',
  )
}

describe('writeMetricsHistoryDistrictWrites', () => {
  it('writes per-district history files using previous history when present', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'history-district-writes-'))
    const nextDir = path.join(base, 'next')
    const prevDir = path.join(base, 'prev')
    const nextDistrictDir = path.join(nextDir, 'xinyi')
    const prevDistrictDir = path.join(prevDir, 'xinyi')

    await writeMeta(nextDistrictDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-02T00:00:00Z',
      segmentsCount: 11,
      overridesAppliedCount: 1,
      signOverridesCount: 2,
      curbMarkingKnownRate: 0.45,
      restrictionTriggeredRate: 0.12,
    })
    await writeMeta(prevDistrictDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-01T00:00:00Z',
    })
    await fs.writeFile(
      path.join(prevDistrictDir, 'metrics_history.jsonl'),
      `${JSON.stringify({ packId: 'prev-pack', districtId: 'xinyi' })}\n`,
      'utf-8',
    )

    const written = await writeMetricsHistoryDistricts({
      packLayout: { kind: 'multi', districts: new Map([['xinyi', nextDistrictDir]]) },
      prevLayout: { kind: 'multi', districts: new Map([['xinyi', prevDistrictDir]]) },
      packId: 'next-pack',
      districtIds: ['xinyi'],
    })

    expect(written).toEqual([path.resolve(nextDistrictDir, 'metrics_history.jsonl')])
    const raw = await fs.readFile(path.join(nextDistrictDir, 'metrics_history.jsonl'), 'utf-8')
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('"packId":"prev-pack"')
    expect(lines[1]).toContain('"packId":"next-pack"')
  })
})
