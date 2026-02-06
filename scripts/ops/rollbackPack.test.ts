import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { rollbackPack } from './rollbackPack'

const buildMeta = (datasetHash: string) => ({
  districtName: 'Xinyi',
  schemaVersion: 1,
  datasetHash,
  generatedAt: '2026-02-02T00:00:00Z',
  publishedAt: '2026-02-03T00:00:00Z',
  files: {
    'red_yellow.geojson': { sha256: 'a', bytes: 1 },
  },
  totalBytes: 1,
})

const readMetaHash = async (dirPath: string) => {
  const raw = await fs.readFile(path.join(dirPath, 'dataset_meta.json'), 'utf-8')
  const meta = JSON.parse(raw) as { datasetHash?: string }
  return meta.datasetHash ?? null
}

describe('rollbackPack', () => {
  it('swaps the pack and updates registry', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'rollback-test-'))
    const baseDir = path.join(base, 'public', 'data', 'generated')
    const backupRoot = path.join(baseDir, '.backup')
    const districtDir = path.join(baseDir, 'xinyi')

    await fs.mkdir(backupRoot, { recursive: true })
    await fs.mkdir(districtDir, { recursive: true })

    const currentMeta = buildMeta('hash-current')
    await fs.writeFile(
      path.join(districtDir, 'dataset_meta.json'),
      JSON.stringify(currentMeta, null, 2),
      'utf-8',
    )

    const backupDir = path.join(backupRoot, 'xinyi-20240201-hash-backup')
    await fs.mkdir(backupDir, { recursive: true })
    const backupMeta = buildMeta('hash-backup')
    await fs.writeFile(
      path.join(backupDir, 'dataset_meta.json'),
      JSON.stringify(backupMeta, null, 2),
      'utf-8',
    )

    await rollbackPack({ baseDir, districtId: 'xinyi', latest: true })

    const activeHash = await readMetaHash(districtDir)
    expect(activeHash).toBe('hash-backup')

    const backupEntries = await fs.readdir(backupRoot, { withFileTypes: true })
    const rollbackEntry = backupEntries.find(
      (entry) => entry.isDirectory() && entry.name.startsWith('xinyi-rollback-'),
    )
    expect(rollbackEntry).toBeDefined()

    if (rollbackEntry) {
      const swappedHash = await readMetaHash(path.join(backupRoot, rollbackEntry.name))
      expect(swappedHash).toBe('hash-current')
    }

    const registryRaw = await fs.readFile(
      path.join(baseDir, 'registry.json'),
      'utf-8',
    )
    const registry = JSON.parse(registryRaw) as {
      districts?: Array<{ districtId: string; datasetHash: string }>
    }
    expect(registry.districts?.[0]?.datasetHash).toBe('hash-backup')

    const logPath = path.join(baseDir, '_ops', 'rollback_log.jsonl')
    const logRaw = await fs.readFile(logPath, 'utf-8')
    expect(logRaw).toContain('"districtId":"xinyi"')

    const latestPath = path.join(baseDir, 'xinyi', 'LATEST.json')
    const latestRaw = await fs.readFile(latestPath, 'utf-8')
    const latest = JSON.parse(latestRaw) as { datasetHash?: string }
    expect(latest.datasetHash).toBe('hash-backup')
  })
})
