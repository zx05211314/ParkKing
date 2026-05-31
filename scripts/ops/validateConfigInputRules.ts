import { normalizeConfigPath, validateConfigPath } from './validateConfigPaths'

export const validateConfigInputs = (
  inputs: Record<string, unknown> | undefined,
  allowAbsolute: boolean,
  ciSafe: boolean,
  errors: string[],
) => {
  const inputEntries = inputs ? Object.entries(inputs) : []
  inputEntries.forEach(([key, value]) => {
    if (!value) {
      return
    }
    if (typeof value !== 'string') {
      errors.push(`inputs.${key} must be a string path`)
      return
    }
    validateConfigPath(value, allowAbsolute, errors, `inputs.${key}`)
    if (ciSafe) {
      const normalized = normalizeConfigPath(value)
      const allowedPrefixes = ['tests/fixtures/', '../tests/fixtures/']
      if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
        errors.push(`inputs.${key} must live under tests/fixtures/ for ciSafe`)
      }
    }
  })
}
