import { loadPublishGateReport } from './publishGateFiles'
import {
  applyPublishGateBaselineAdopt,
  resolvePublishGateBootstrapState,
} from './publishGateDecision'
import { validatePublishGateDistricts } from './publishGateDistrictValidation'
import {
  buildPublishGateDistrictSummaries,
  buildPublishGateTotals,
  resolvePublishGateExitCode,
} from './publishGateSummary'
import { resolvePublishGateRuntimeOptions } from './publishGateRuntimeOptions'
import type { PublishGateOptions } from './publishGateTypes'

export const loadPublishGateExecutionState = async (options: PublishGateOptions) => {
  const runtime = await resolvePublishGateRuntimeOptions(options)

  const report = await loadPublishGateReport(runtime.reportPath)
  const districts = report.districts ?? []
  const bootstrapState = await resolvePublishGateBootstrapState({
    districts,
    overrideReason: runtime.overrideReason,
    allowFail: runtime.allowFail,
    publishedRootDir: runtime.publishedRootDir,
  })

  let checkedDistricts = await validatePublishGateDistricts(districts, {
    datasetRootDir: runtime.datasetRootDir,
    publishedRootDir: runtime.publishedRootDir,
    strictDiff: runtime.strictDiff,
  })

  const baselineAdoptState = applyPublishGateBaselineAdopt({
    checkedDistricts,
    allowBaselineAdopt: runtime.allowBaselineAdopt,
    overrideReason: runtime.overrideReason,
    gateMessageFlags: bootstrapState.gateMessageFlags,
  })
  checkedDistricts = baselineAdoptState.checkedDistricts

  const districtSummaries = buildPublishGateDistrictSummaries(checkedDistricts)
  const totals = buildPublishGateTotals(districtSummaries)
  const exitCode = resolvePublishGateExitCode({
    totals,
    mode: runtime.mode,
    allowWarn: runtime.allowWarn,
    effectiveAllowFail: bootstrapState.effectiveAllowFail,
  })

  return {
    runtime,
    bootstrapState,
    baselineAdoptState,
    districtSummaries,
    totals,
    exitCode,
  }
}
