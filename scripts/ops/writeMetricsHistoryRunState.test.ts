import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

import { resolveMetricsHistoryRunState } from './writeMetricsHistoryRunState'

const writeMeta = async (dir: string, meta: Record<string, unknown>) => {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'dataset_meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8',
  )
}

describe('writeMetricsHistoryRunState', () => {
  it('resolves pack layout, sibling previous pack, and sorted district ids', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'history-run-state-'))
    const packDir = path.join(base, 'xinyi-pack')
    const prevPackDir = path.join(base, 'xinyi')

    await writeMeta(packDir, { districtId: 'xinyi' })
    await writeMeta(prevPackDir, { districtId: 'xinyi' })

    const result = await resolveMetricsHistoryRunState({ packDir })

    expect(result.packId).toBe('xinyi-pack')
    expect(result.prevPackDir).toBe(path.resolve(prevPackDir))
    expect(result.districtIds).toEqual(['xinyi'])
    expect(result.prevLayout?.districts.get('xinyi')).toBe(path.resolve(prevPackDir))
  })
})
