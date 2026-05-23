import { describe, expect, it } from 'vitest'
import {
  validateConfigOpsWarnings,
  validateRequiredConfigFields,
} from './validateConfigRequiredFields'

describe('validateRequiredConfigFields', () => {
  it('flags missing district and inputs fields', () => {
    const errors: string[] = []

    expect(validateRequiredConfigFields({}, errors)).toEqual({
      districtId: undefined,
      inputs: undefined,
    })
    expect(errors).toEqual([
      'districtId is required',
      'districtName is required',
      'inputs section is required',
    ])
  })
})

describe('validateConfigOpsWarnings', () => {
  it('warns when the ops section is missing', () => {
    const warnings: string[] = []

    validateConfigOpsWarnings({}, warnings)

    expect(warnings).toEqual(['ops section missing; defaults will be used'])
  })
})
