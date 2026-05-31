import type {
  BaselineMetrics,
  CurrentMetrics,
  Warning,
} from './compareBaselineTypes'

export const buildBaselineComparisonPrelude = (
  current: CurrentMetrics,
  baseline: BaselineMetrics | null,
): Warning[] => {
  if (!baseline) {
    return [
      {
        severity: 'WARN',
        code: 'BASELINE_MISSING',
        message: 'Baseline missing; generate with npm run ops:baseline',
      },
    ]
  }

  const warnings: Warning[] = []
  if (
    typeof baseline.baselineSchemaVersion === 'number' &&
    typeof current.schemaVersion === 'number' &&
    baseline.baselineSchemaVersion !== current.schemaVersion
  ) {
    warnings.push({
      severity: 'WARN',
      code: 'BASELINE_SCHEMA_MISMATCH',
      message: `Baseline schemaVersion ${baseline.baselineSchemaVersion} does not match current ${current.schemaVersion}`,
    })
  }

  if (
    baseline.baselineDatasetHash &&
    current.datasetHash &&
    baseline.baselineDatasetHash === current.datasetHash
  ) {
    warnings.push({
      severity: 'INFO',
      code: 'BASELINE_HASH_MATCH',
      message: `Baseline datasetHash matches current (${current.datasetHash}).`,
    })
  }

  return warnings
}
