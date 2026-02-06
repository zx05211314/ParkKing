import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { writeMetricsHistory } from './writeMetricsHistory'

const HISTORY_MAX_LINES = 180

const writeMeta = async (dir: string, meta: Record<string, unknown>) => {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'dataset_meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8',
  )
}

const readHistoryLines = async (dir: string) => {
  const raw = await fs.readFile(path.join(dir, 'metrics_history.jsonl'), 'utf-8')
  return raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
}

describe('writeMetricsHistory', () => {
  it('creates history when none exists', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'history-test-'))
    const packDir = path.join(base, 'xinyi-pack')
    await writeMeta(packDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-01T00:00:00Z',
      segmentsCount: 12,
      overridesAppliedCount: 1,
      signOverridesCount: 2,
      curbMarkingKnownRate: 0.5,
      restrictionTriggeredRate: 0.2,
    })

    await writeMetricsHistory({ packDir })

    const lines = await readHistoryLines(packDir)
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.packId).toBe('xinyi-pack')
    expect(parsed.districtId).toBe('xinyi')
    expect(parsed.segmentsCount).toBe(12)
  })

  it('writes history per district for multi-pack', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'history-test-multi-'))
    const packDir = path.join(base, 'pack')
    const xinyiDir = path.join(packDir, 'xinyi')
    const daanDir = path.join(packDir, 'daan')

    await writeMeta(xinyiDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-01T00:00:00Z',
      segmentsCount: 5,
      overridesAppliedCount: 0,
      signOverridesCount: 1,
      curbMarkingKnownRate: 0.4,
      restrictionTriggeredRate: 0.1,
    })
    await writeMeta(daanDir, {
      districtId: 'daan',
      publishedAt: '2026-02-01T00:00:00Z',
      segmentsCount: 7,
      overridesAppliedCount: 1,
      signOverridesCount: 2,
      curbMarkingKnownRate: 0.6,
      restrictionTriggeredRate: 0.2,
    })

    await writeMetricsHistory({ packDir })

    const xinyiLines = await readHistoryLines(xinyiDir)
    const daanLines = await readHistoryLines(daanDir)
    expect(xinyiLines).toHaveLength(1)
    expect(daanLines).toHaveLength(1)
  })

  it('preserves previous history and appends new entry', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'history-test-prev-'))
    const prevDir = path.join(base, 'prev')
    const nextDir = path.join(base, 'next')

    await writeMeta(prevDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-01T00:00:00Z',
      segmentsCount: 10,
      overridesAppliedCount: 0,
      signOverridesCount: 1,
      curbMarkingKnownRate: 0.4,
      restrictionTriggeredRate: 0.1,
    })

    const previousLine = JSON.stringify({
      schemaVersion: 1,
      publishedAt: '2026-01-01T00:00:00Z',
      packId: 'prev-pack',
      districtId: 'xinyi',
      segmentsCount: 9,
      overridesAppliedCount: 0,
      signOverridesCount: 1,
      curbMarkingKnownRate: 0.3,
      restrictionTriggeredRate: 0.1,
      provenanceFetchedAt: null,
    })
    await fs.writeFile(
      path.join(prevDir, 'metrics_history.jsonl'),
      `${previousLine}\n`,
      'utf-8',
    )

    await writeMeta(nextDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-02T00:00:00Z',
      segmentsCount: 11,
      overridesAppliedCount: 1,
      signOverridesCount: 2,
      curbMarkingKnownRate: 0.45,
      restrictionTriggeredRate: 0.12,
    })

    await writeMetricsHistory({ packDir: nextDir, prevPackDir: prevDir })

    const lines = await readHistoryLines(nextDir)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(previousLine)
  })

  it('caps history to the most recent entries', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'history-test-cap-'))
    const prevDir = path.join(base, 'prev')
    const nextDir = path.join(base, 'next')

    await writeMeta(prevDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-01T00:00:00Z',
      segmentsCount: 10,
      overridesAppliedCount: 0,
      signOverridesCount: 1,
      curbMarkingKnownRate: 0.4,
      restrictionTriggeredRate: 0.1,
    })

    const previousCount = HISTORY_MAX_LINES + 5
    const previousLines = Array.from({ length: previousCount }, (_value, index) =>
      JSON.stringify({
        schemaVersion: 1,
        publishedAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
        packId: 'prev-pack',
        districtId: 'xinyi',
        segmentsCount: index,
        overridesAppliedCount: 0,
        signOverridesCount: 1,
        curbMarkingKnownRate: 0.3,
        restrictionTriggeredRate: 0.1,
        provenanceFetchedAt: null,
      }),
    )

    await fs.writeFile(
      path.join(prevDir, 'metrics_history.jsonl'),
      `${previousLines.join('\n')}\n`,
      'utf-8',
    )

    await writeMeta(nextDir, {
      districtId: 'xinyi',
      publishedAt: '2026-02-02T00:00:00Z',
      segmentsCount: 999,
      overridesAppliedCount: 2,
      signOverridesCount: 3,
      curbMarkingKnownRate: 0.55,
      restrictionTriggeredRate: 0.15,
    })

    await writeMetricsHistory({ packDir: nextDir, prevPackDir: prevDir })

    const lines = await readHistoryLines(nextDir)
    expect(lines).toHaveLength(HISTORY_MAX_LINES)
    const first = JSON.parse(lines[0]) as Record<string, unknown>
    const last = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>
    expect(first.segmentsCount).toBe(previousCount - HISTORY_MAX_LINES + 1)
    expect(last.segmentsCount).toBe(999)
  })
})
