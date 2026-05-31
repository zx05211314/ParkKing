import type { ConfigIssue, ValidateOptions } from './validateConfigTypes'
import { validateConfigInputs } from './validateConfigInputRules'
import { validateConfigOutputs } from './validateConfigOutputRules'
import {
  validateConfigOpsWarnings,
  validateRequiredConfigFields,
} from './validateConfigRequiredFields'

export const validateConfigIssue = (
  configPath: string,
  config: Record<string, unknown>,
  options: ValidateOptions,
): ConfigIssue => {
  const errors: string[] = []
  const warnings: string[] = []

  const { districtId, inputs } = validateRequiredConfigFields(config, errors)
  const ciSafe = config.ciSafe === true
  const outputs = config.outputs as Record<string, unknown> | undefined
  const allowAbsolute = Boolean(options.allowAbsolute)

  validateConfigInputs(inputs, allowAbsolute, ciSafe, errors)
  validateConfigOutputs(outputs, districtId, allowAbsolute, errors, warnings)
  validateConfigOpsWarnings(config, warnings)

  return {
    configPath,
    errors,
    warnings,
  }
}
