import { describe, expect, it } from 'vitest'
import {
  resolvePublishGateSignOverrideRequirement,
  validatePublishGateSignOverrideCoverage,
} from './publishGateSignOverrideValidation'

describe('publishGateSignOverrideValidation', () => {
  it('does not require sign override coverage without explicit or legacy thresholds', () => {
    expect(resolvePublishGateSignOverrideRequirement({ districtId: 'xinyi' })).toBeNull()
  })

  it('fails required districts with missing input and zero applied coverage', () => {
    const warnings = validatePublishGateSignOverrideCoverage({
      districtId: 'xinyi',
      district: {
        districtId: 'xinyi',
        validation: {
          minCounts: {
            signOverrides: 1,
            overridesApplied: 1,
          },
        },
      },
      meta: {
        signOverridesCount: 0,
        overridesAppliedCount: 0,
        signOverridesUpdatedAt: null,
      },
    })

    expect(warnings.map((warning) => warning.code)).toEqual([
      'SIGN_OVERRIDE_INPUT_MISSING',
      'SIGN_OVERRIDE_COVERAGE_ZERO',
    ])
  })

  it('treats legacy sign override delta thresholds as a minimum coverage requirement', () => {
    expect(
      resolvePublishGateSignOverrideRequirement({
        districtId: 'xinyi',
        thresholds: {
          counts: {
            signOverrides: 30,
          },
        },
      }),
    ).toEqual({
      minSignOverrides: 1,
      minOverridesApplied: 1,
      sources: ['thresholds.counts.signOverrides'],
    })
  })

  it('does not require applied coverage from legacy thresholds when sign input exists', () => {
    expect(
      resolvePublishGateSignOverrideRequirement({
        districtId: 'xinyi',
        counts: {
          signOverrides: 2,
        },
        thresholds: {
          counts: {
            signOverrides: 30,
          },
        },
      }),
    ).toEqual({
      minSignOverrides: 1,
      minOverridesApplied: 0,
      sources: ['thresholds.counts.signOverrides'],
    })
  })
})
