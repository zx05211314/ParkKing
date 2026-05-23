import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  listDistrictIdsInPack,
  readPublishedAt,
} from './reportGateAnomalyPackMeta'

describe('reportGateAnomalyPackMeta', () => {
  it('reads publishedAt and lists nested district packs', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'report-gate-pack-meta-'))
    const alpha = path.join(root, 'alpha')
    const beta = path.join(root, 'beta')
    await fs.mkdir(alpha, { recursive: true })
    await fs.mkdir(beta, { recursive: true })
    await fs.writeFile(
      path.join(alpha, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'alpha', publishedAt: '2026-03-21T00:00:00.000Z' }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(beta, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'beta' }),
      'utf-8',
    )

    await expect(readPublishedAt(alpha, 'alpha')).resolves.toBe('2026-03-21T00:00:00.000Z')
    await expect(listDistrictIdsInPack(root)).resolves.toEqual(['alpha', 'beta'])
  })
})
