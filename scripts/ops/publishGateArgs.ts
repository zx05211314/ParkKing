export interface PublishGateCliArgs {
  reportPath: string | null
  mode: string | null
  allowWarn: boolean
  allowFail: boolean
  allowBaselineAdopt: boolean
  overrideReason: string | null
  datasetRootDir: string | null
}

export const parsePublishGateArgs = (argv: string[]): PublishGateCliArgs => {
  const args = [...argv]
  const reportIndex = args.findIndex((arg) => arg === '--report')
  const modeIndex = args.findIndex((arg) => arg === '--mode')
  const overrideIndex = args.findIndex((arg) => arg === '--override')
  const rootIndex = args.findIndex((arg) => arg === '--datasetRoot')

  return {
    reportPath: reportIndex >= 0 ? args[reportIndex + 1] : null,
    mode: modeIndex >= 0 ? args[modeIndex + 1] : null,
    allowWarn: args.includes('--allowWarn'),
    allowFail: args.includes('--allowFail'),
    allowBaselineAdopt: args.includes('--allowBaselineAdopt'),
    overrideReason: overrideIndex >= 0 ? args[overrideIndex + 1] : null,
    datasetRootDir: rootIndex >= 0 ? args[rootIndex + 1] : null,
  }
}
