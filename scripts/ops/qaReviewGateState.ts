import * as path from 'node:path'
import { readConfig } from '../ingest/readConfig'
import { normalizeDistrictId } from './exportOverrideNormalization'
import { exportOverrides } from './exportOverrides'
import { resolveQaReviewGateInputKind } from './qaReviewGateInput'
import { buildQaReviewReportSummary } from './qaReviewGateReportSummary'
import { buildQaReviewSummary } from './qaReviewSummaryState'
import type { QaReviewGateParams, QaReviewGateResult } from './qaReviewGateTypes'
import { buildSignOverridePreflight } from './signOverridePreflightState'

const defaultOutDir = () => path.resolve('data', 'overrides')

const buildManifestConfigErrors = (
  summary: QaReviewGateResult['summary'],
  config: Awaited<ReturnType<typeof readConfig>>,
) => {
  const manifest = summary.manifest
  if (!manifest) {
    return []
  }

  const errors: string[] = []
  if (manifest.districtId && manifest.districtId !== config.districtId) {
    errors.push(
      `Review manifest district ${manifest.districtId} does not match config district ${config.districtId}.`,
    )
  }
  if (manifest.configHash && manifest.configHash !== config.configHash) {
    errors.push(
      `Review manifest config hash ${manifest.configHash} does not match current config hash ${config.configHash}. Treat this as stale provenance unless you have confirmed the current config drift is non-data-affecting.`,
    )
  }
  const manifestSourceHash = manifest.datasetSourceHash ?? manifest.datasetHash
  if (manifestSourceHash && manifestSourceHash !== config.datasetSourceHash) {
    errors.push(
      `Review manifest source hash ${manifestSourceHash} does not match current source hash ${config.datasetSourceHash}. Treat this as stale provenance unless you have confirmed the current config drift is non-data-affecting.`,
    )
  }
  if (manifest.generatorHash && manifest.generatorHash !== config.generatorHash) {
    errors.push(
      `Review manifest generator hash ${manifest.generatorHash} does not match current generator hash ${config.generatorHash}. Regenerate and review the packet because ingest behavior changed.`,
    )
  }
  return errors
}

export const buildQaReviewGate = async ({
  inputPath,
  manifestPath,
  configPath,
  outDir,
  strictManifest = true,
  strictConfigProvenance = true,
  strictReviewedRows = true,
  strictReviewedSegments = true,
  nextReviewRowsLimit = 10,
  minReviewed = 1,
  requireStatuses = [],
  requireBuckets = [],
  minReviewedBuckets = {},
}: QaReviewGateParams): Promise<QaReviewGateResult> => {
  const resolvedInputPath = path.resolve(inputPath)
  const resolvedConfigPath = path.resolve(configPath)
  const defaultOverridesDir = defaultOutDir()
  const resolvedOutDir = outDir ? path.resolve(outDir) : defaultOverridesDir
  const errors: string[] = []
  const warnings: string[] = []
  const inputKind = await resolveQaReviewGateInputKind(resolvedInputPath)
  if (resolvedOutDir !== defaultOverridesDir) {
    warnings.push(
      `Override output directory ${resolvedOutDir} is not the ingest default ${defaultOverridesDir}; ingestSignOverrides reads the default path unless the file is copied there.`,
    )
  }

  const summary =
    inputKind === 'csv'
      ? await buildQaReviewSummary({
          inputPath: resolvedInputPath,
          manifestPath,
          strictManifest,
          strictReviewedRows,
          strictReviewedSegments,
          nextReviewRowsLimit,
          minReviewed,
          requireStatuses,
          requireBuckets,
          minReviewedBuckets,
        })
      : await buildQaReviewReportSummary({
          inputPath: resolvedInputPath,
          strictReviewedRows,
          strictReviewedSegments,
          nextReviewRowsLimit,
          minReviewed,
          requireStatuses,
          requireBuckets,
          minReviewedBuckets,
        })
  errors.push(...summary.errors)
  warnings.push(...summary.warnings)

  if (!summary.pass) {
    return {
      inputPath: resolvedInputPath,
      inputKind,
      configPath: resolvedConfigPath,
      outDir: resolvedOutDir,
      summary,
      exports: [],
      preflight: null,
      errors,
      warnings,
      pass: false,
    }
  }

  const config = await readConfig([
    'node',
    'qa-review-gate',
    '--config',
    resolvedConfigPath,
  ])
  const manifestConfigErrors = buildManifestConfigErrors(summary, config)
  const manifestDistrictErrors = manifestConfigErrors.filter((error) =>
    error.startsWith('Review manifest district '),
  )
  const manifestProvenanceErrors = manifestConfigErrors.filter(
    (error) => !error.startsWith('Review manifest district '),
  )
  errors.push(...manifestDistrictErrors)
  if (strictConfigProvenance) {
    errors.push(...manifestProvenanceErrors)
  } else {
    warnings.push(...manifestProvenanceErrors)
  }
  if (errors.length > 0) {
    return {
      inputPath: resolvedInputPath,
      inputKind,
      configPath: resolvedConfigPath,
      outDir: resolvedOutDir,
      summary,
      exports: [],
      preflight: null,
      errors,
      warnings,
      pass: false,
    }
  }

  const exports = await exportOverrides({
    inputPath: resolvedInputPath,
    outDir: resolvedOutDir,
  })
  const exportedPath = path.resolve(
    resolvedOutDir,
    `${normalizeDistrictId(config.districtId)}.jsonl`,
  )
  const preflight = await buildSignOverridePreflight(resolvedConfigPath, exportedPath)

  if (!preflight.inputExists) {
    errors.push(`Export did not produce override input for ${config.districtId}.`)
  }
  if (preflight.effectiveOverrides < minReviewed) {
    errors.push(
      `Effective overrides ${preflight.effectiveOverrides} is below required minimum ${minReviewed}.`,
    )
  }
  if (preflight.matchedSegmentOverrides < minReviewed) {
    errors.push(
      `Matched segment overrides ${preflight.matchedSegmentOverrides} is below required minimum ${minReviewed}.`,
    )
  }
  if (preflight.missingSegmentOverrides > 0) {
    errors.push(
      `${preflight.missingSegmentOverrides} override(s) reference unknown segment ids.`,
    )
  }
  if (preflight.skippedForeignDistrictReports > 0) {
    warnings.push(
      `${preflight.skippedForeignDistrictReports} valid report(s) target another district and were ignored by preflight.`,
    )
  }
  if (preflight.duplicateSegmentsCollapsed > 0) {
    warnings.push(
      `${preflight.duplicateSegmentsCollapsed} duplicate segment report(s) were collapsed to latest verdict.`,
    )
  }

  return {
    inputPath: resolvedInputPath,
    inputKind,
    configPath: resolvedConfigPath,
    outDir: resolvedOutDir,
    summary,
    exports,
    preflight,
    errors,
    warnings,
    pass: errors.length === 0,
  }
}
