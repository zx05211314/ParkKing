import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { exportOverrides } from './exportOverrides'

describe('exportOverrides', () => {
  it('writes deterministic jsonl output per district', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-'))
    const inputPath = path.join(base, 'reports.json')
    const outDir = path.join(base, 'out')

    const payload = {
      schemaVersion: 1,
      reports: [
        {
          districtId: 'xinyi',
          segmentId: 'seg-2-part-1',
          status: 'ILLEGAL',
          createdAt: '2026-02-02T00:00:00Z',
        },
        {
          districtId: 'xinyi',
          segmentId: 'seg-2-part-1',
          status: 'LEGAL',
          createdAt: '2026-02-03T00:00:00Z',
        },
        {
          districtId: 'xinyi',
          segmentId: 'seg-1-part-2',
          status: 'LEGAL',
          note: '  ok  ',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          districtId: 'daan',
          segmentId: 'seg-9',
          status: 'UNCLEAR',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ],
    }

    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), 'utf-8')

    await exportOverrides({ inputPath, outDir })

    const xinyiRaw = await fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')
    const xinyiLines = xinyiRaw.trim().split(/\r?\n/).map((line) => JSON.parse(line))

    expect(xinyiLines).toHaveLength(2)
    expect(xinyiLines[0].segmentId).toBe('seg-1')
    expect(xinyiLines[0].status).toBe('LEGAL')
    expect(xinyiLines[0].note).toBe('ok')
    expect(xinyiLines[1].segmentId).toBe('seg-2')
    expect(xinyiLines[1].status).toBe('LEGAL')
    expect(xinyiLines[1].schemaVersion).toBe(1)

    const daanRaw = await fs.readFile(path.join(outDir, 'daan.jsonl'), 'utf-8')
    const daanLines = daanRaw.trim().split(/\r?\n/).map((line) => JSON.parse(line))
    expect(daanLines).toHaveLength(1)
    expect(daanLines[0].segmentId).toBe('seg-9')
    expect(daanLines[0].schemaVersion).toBe(1)
  })
})
