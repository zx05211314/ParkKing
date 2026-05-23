import { describe, expect, it } from 'vitest'
import { validateConfigInputs } from './validateConfigInputRules'

describe('validateConfigInputs', () => {
  it('rejects non-string input paths', () => {
    const errors: string[] = []

    validateConfigInputs(
      {
        redYellow: 42,
      },
      false,
      false,
      errors,
    )

    expect(errors).toEqual(['inputs.redYellow must be a string path'])
  })
})
