import { describe, expect, it } from 'vitest'
import { validateConfigOutputs } from './validateConfigOutputRules'

describe('validateConfigOutputs', () => {
  it('warns when output directories cannot be checked without districtId', () => {
    const errors: string[] = []
    const warnings: string[] = []

    validateConfigOutputs(
      {
        generatedDir: 'public/data/generated/xinyi',
      },
      undefined,
      false,
      errors,
      warnings,
    )

    expect(errors).toEqual([])
    expect(warnings).toEqual(['outputs.generatedDir cannot be checked without districtId'])
  })
})
