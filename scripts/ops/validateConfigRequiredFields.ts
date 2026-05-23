export const validateRequiredConfigFields = (
  config: Record<string, unknown>,
  errors: string[],
) => {
  const districtId = config.districtId as string | undefined
  const districtName = config.districtName as string | undefined

  if (!districtId) {
    errors.push('districtId is required')
  }
  if (!districtName) {
    errors.push('districtName is required')
  }

  const inputs = config.inputs as Record<string, unknown> | undefined
  if (!inputs) {
    errors.push('inputs section is required')
  }

  return { districtId, inputs }
}

export const validateConfigOpsWarnings = (
  config: Record<string, unknown>,
  warnings: string[],
) => {
  if (!config.ops) {
    warnings.push('ops section missing; defaults will be used')
  } else if (!(config.ops as Record<string, unknown>).thresholds) {
    warnings.push('ops.thresholds missing; defaults will be used')
  }
}
