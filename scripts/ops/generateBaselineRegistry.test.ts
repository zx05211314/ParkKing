import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadGenerateBaselineEntries } from './generateBaselineRegistry'

const writeJson = async (filePath: string, payload: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

describe('loadGenerateBaselineEntries', () => {
  it('returns all registry districts when no filter is provided', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'baseline-registry-'))
    const registryPath = path.join(base, 'registry.json')
    await writeJson(registryPath, {
      districts: [
        {
          districtId: 'xinyi',
          districtName: 'Xinyi',
          generatedAt: '2026-01-01T00:00:00.000Z',
          datasetHash: 'hash-a',
          schemaVersion: 1,
        },
      ],
    })

    const loaded = await loadGenerateBaselineEntries({ registryPath })

    expect(loaded.entries).toHaveLength(1)
    expect(loaded.entries[0]?.districtId).toBe('xinyi')
    expect(loaded.registryPath).toBe(path.resolve(registryPath))
  })

  it('throws when the requested district is missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'baseline-registry-'))
    const registryPath = path.join(base, 'registry.json')
    await writeJson(registryPath, {
      districts: [
        {
          districtId: 'daan',
          districtName: 'Daan',
          generatedAt: '2026-01-01T00:00:00.000Z',
          datasetHash: 'hash-b',
          schemaVersion: 1,
        },
      ],
    })

    await expect(
      loadGenerateBaselineEntries({
        registryPath,
        districtIdFilter: 'xinyi',
      }),
    ).rejects.toThrow('District xinyi not found in registry')
  })
})
