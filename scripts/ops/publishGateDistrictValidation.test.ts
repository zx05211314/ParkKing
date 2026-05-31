import { describe, expect, it, vi } from 'vitest'
import { validatePublishGateDistricts } from './publishGateDistrictValidation'

describe('publishGateDistrictValidation', () => {
  it('appends dataset validation warnings onto each district', async () => {
    const validateDatasetPackFn = vi
      .fn()
      .mockResolvedValueOnce([{ severity: 'WARN', code: 'A', message: 'a' }])
      .mockResolvedValueOnce([{ severity: 'FAIL', code: 'B', message: 'b' }])
    const loadContextFn = vi
      .fn()
      .mockResolvedValueOnce({ status: 'invalid', warnings: [] })
      .mockResolvedValueOnce({ status: 'invalid', warnings: [] })

    await expect(
      validatePublishGateDistricts(
        [
          { districtId: 'xinyi', warnings: [{ severity: 'INFO', code: 'BASE', message: 'base' }] },
          { districtId: 'daan' },
        ],
        {
          datasetRootDir: 'data/generated',
          publishedRootDir: 'public/data/generated',
          strictDiff: true,
        },
        validateDatasetPackFn as never,
        loadContextFn as never,
      ),
    ).resolves.toEqual([
      {
        districtId: 'xinyi',
        warnings: [
          { severity: 'INFO', code: 'BASE', message: 'base' },
          { severity: 'WARN', code: 'A', message: 'a' },
        ],
      },
      {
        districtId: 'daan',
        warnings: [{ severity: 'FAIL', code: 'B', message: 'b' }],
      },
    ])
  })
})
