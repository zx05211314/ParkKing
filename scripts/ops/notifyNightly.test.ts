import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildNightlyIssueBody,
  collectNightlyAlerts,
  resolveDiffPaths,
} from './notifyNightly'

describe('notifyNightly', () => {
  it('resolves diff path from directory', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-'))
    const diffPath = path.join(base, 'diff_report.json')
    await fs.writeFile(diffPath, '{}', 'utf-8')

    const resolved = await resolveDiffPaths([base])
    expect(resolved).toEqual([diffPath])
  })

  it('resolves diff path from file', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-file-'))
    const diffPath = path.join(base, 'diff_report.json')
    await fs.writeFile(diffPath, '{}', 'utf-8')

    const resolved = await resolveDiffPaths([diffPath])
    expect(resolved).toEqual([diffPath])
  })

  it('throws usage error when diff is missing', async () => {
    await expect(resolveDiffPaths([])).rejects.toThrow('Usage:')
  })

  it('builds issue body with WARN/FAIL entries', () => {
    const alerts = collectNightlyAlerts([
      {
        districts: [
          {
            districtId: 'xinyi',
            severity: 'WARN',
            meta: {
              segmentsCount: { deltaPct: -0.2 },
              curbMarkingKnownRate: { delta: -0.12 },
              restrictionTriggeredRate: { delta: -0.02 },
            },
          },
          {
            districtId: 'daan',
            severity: 'FAIL',
            meta: {
              segmentsCount: { deltaPct: -1 },
              curbMarkingKnownRate: { delta: -0.2 },
              restrictionTriggeredRate: { delta: -0.05 },
            },
          },
        ],
      },
    ])

    const body = buildNightlyIssueBody({ alerts, runUrl: 'https://example.com/run' })
    expect(body).toContain('xinyi')
    expect(body).toContain('WARN')
    expect(body).toContain('daan')
    expect(body).toContain('FAIL')
    expect(body).toContain('Segments Δ%')
    expect(body).toContain('Curb known Δ')
  })
})
