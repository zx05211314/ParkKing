import { resolveDefaultPublishGateReport } from './publishGateFiles'
import { BASELINE_ADOPT_ENV } from './publishGatePolicy'
import type { PublishGateOptions } from './publishGateTypes'

export interface ResolvedPublishGateRuntimeOptions {
  reportPath: string
  mode: 'strict' | 'warn'
  allowWarn: boolean
  allowFail: boolean
  allowBaselineAdopt: boolean
  overrideReason: string | null
  outputDir: string
  datasetRootDir: string | undefined
  publishedRootDir: string | null
  strictDiff: boolean
}

export const resolvePublishGateRuntimeOptions = async (
  options: PublishGateOptions,
  deps: {
    env?: NodeJS.ProcessEnv
    resolveDefaultReport?: () => Promise<string>
  } = {},
): Promise<ResolvedPublishGateRuntimeOptions> => {
  const env = deps.env ?? process.env
  const reportPath =
    options.reportPath ?? (await (deps.resolveDefaultReport ?? resolveDefaultPublishGateReport)())
  const mode = options.mode === 'warn' ? 'warn' : 'strict'
  const allowWarn = Boolean(options.allowWarn)
  const allowFail = Boolean(options.allowFail)
  const allowBaselineAdopt =
    Boolean(options.allowBaselineAdopt) ||
    /^(1|true|yes)$/i.test(env[BASELINE_ADOPT_ENV] ?? '')
  const overrideReason = options.overrideReason ?? null
  const outputDir = options.outputDir ?? 'public/data/generated'
  const datasetRootDir = options.datasetRootDir
  const publishedRootDir = options.publishedRootDir ?? null
  const strictDiff = /^(1|true|yes)$/i.test(env.PARKKING_GATE_STRICT ?? '')

  if (
    (allowWarn || allowFail || allowBaselineAdopt) &&
    (!overrideReason || overrideReason.trim().length === 0)
  ) {
    throw new Error('Override reason is required when allowWarn, allowFail, or baseline adopt is set.')
  }

  return {
    reportPath,
    mode,
    allowWarn,
    allowFail,
    allowBaselineAdopt,
    overrideReason,
    outputDir,
    datasetRootDir,
    publishedRootDir,
    strictDiff,
  }
}
