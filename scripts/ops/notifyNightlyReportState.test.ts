import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadNightlyAlertsFromInputs } from './notifyNightlyReportState'

describe('notifyNightlyReportState', () => {
  it('loads alerts from diff inputs through the shared diff reader path', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-state-'))
    const diffPath = path.join(baseDir, 'diff_report.json')
    await fs.writeFile(
      diffPath,
      JSON.stringify({
        districts: [
          { districtId: 'xinyi', severity: 'OK' },
          {
            districtId: 'daan',
            severity: 'WARN',
            meta: {
              segmentsCount: { deltaPct: -0.5 },
              signOverrideMatchedSegmentCount: { delta: 2 },
              signOverrideSpatialMatchCount: { delta: 1 },
              signOverrideUnmatchedNamedCount: { delta: 1 },
              curbMarkingKnownRate: { delta: -0.12 },
              restrictionTriggeredRate: { delta: -0.03 },
            },
          },
        ],
      }),
      'utf-8',
    )

    const result = await loadNightlyAlertsFromInputs([diffPath])
    expect(result.diffPaths).toEqual([diffPath])
    expect(result.alerts).toEqual([
      {
        districtId: 'daan',
        severity: 'WARN',
        segmentsDeltaPct: -0.5,
        directOverrideMatchesDelta: 2,
        spatialOverrideMatchesDelta: 1,
        unmatchedNamedOverridesDelta: 1,
        curbKnownDelta: -0.12,
        restrictionDelta: -0.03,
      },
    ])
  })
})
