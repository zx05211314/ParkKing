import { describe, expect, it, vi } from 'vitest'
import * as diffValidation from './publishGateDiffValidation'
import * as hashValidation from './publishGateHashValidation'
import * as overridesValidation from './publishGateOverridesValidation'
import { validateReadyPublishGateDataset } from './publishGateDatasetValidationRules'

describe('publishGateDatasetValidationRules', () => {
  it('collects downstream validation warnings for a ready dataset', async () => {
    const diffSpy = vi
      .spyOn(diffValidation, 'buildPublishGateDiffWarnings')
      .mockResolvedValue([
        { severity: 'WARN', code: 'DIFF_WARN', message: 'diff warning' },
      ])
    const hashSpy = vi
      .spyOn(hashValidation, 'validatePublishGateFileHashes')
      .mockResolvedValue([
        { severity: 'WARN', code: 'HASH_WARN', message: 'hash warning' },
      ])
    const overridesSpy = vi
      .spyOn(overridesValidation, 'validatePublishGateOverridesApplied')
      .mockResolvedValue([
        { severity: 'WARN', code: 'OVERRIDE_WARN', message: 'override warning' },
      ])

    const warnings = await validateReadyPublishGateDataset({
      districtId: 'xinyi',
      datasetDir: '/dataset/xinyi',
      meta: {
        boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        boundaryCenter: [0.5, 0.5],
        counts: {
          segments: 1,
          intersections: 1,
          inferredCandidates: 0,
          signOverrides: 0,
        },
        curbMarkingKnownRate: 1,
        restrictionTriggeredRate: 1,
      },
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'OVERRIDE_WARN' }),
        expect.objectContaining({ code: 'HASH_WARN' }),
        expect.objectContaining({ code: 'DIFF_WARN' }),
      ]),
    )
    expect(overridesSpy).toHaveBeenCalledWith(
      'xinyi',
      '/dataset/xinyi',
      expect.any(Object),
    )

    diffSpy.mockRestore()
    hashSpy.mockRestore()
    overridesSpy.mockRestore()
  })
})
