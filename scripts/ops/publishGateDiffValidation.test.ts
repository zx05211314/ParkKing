import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildPublishGateDiffWarnings } from './publishGateDiffValidation'

describe('publishGateDiffValidation', () => {
  it('escalates diff_report warnings when strict diff is enabled', async () => {
    const datasetDir = await fs.mkdtemp(
      path.join(tmpdir(), 'publish-gate-diff-validation-'),
    )
    await fs.writeFile(
      path.join(datasetDir, 'diff_report.json'),
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        prevPath: null,
        nextPath: datasetDir,
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
            issues: [
              {
                severity: 'WARN',
                code: 'DIFF_SEGMENT_COUNT_DELTA',
                message: 'segment count changed',
              },
            ],
            meta: {},
            files: { added: [], removed: [], modified: [] },
          },
        ],
      }),
      'utf-8',
    )

    await expect(
      buildPublishGateDiffWarnings('xinyi', datasetDir, null, true),
    ).resolves.toEqual([
      expect.objectContaining({
        code: 'DIFF_SEGMENT_COUNT_DELTA',
        severity: 'FAIL',
      }),
    ])
  })
})
