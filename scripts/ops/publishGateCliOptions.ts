import type { PublishGateCliArgs } from './publishGateArgs'
import type { PublishGateOptions } from './publishGateTypes'

export const buildPublishGateOptionsFromArgs = (
  args: PublishGateCliArgs,
): PublishGateOptions => ({
  reportPath: args.reportPath ?? undefined,
  mode: args.mode === 'warn' ? 'warn' : 'strict',
  allowWarn: args.allowWarn,
  allowFail: args.allowFail,
  allowBaselineAdopt: args.allowBaselineAdopt,
  overrideReason: args.overrideReason ?? undefined,
  datasetRootDir: args.datasetRootDir ?? undefined,
})
