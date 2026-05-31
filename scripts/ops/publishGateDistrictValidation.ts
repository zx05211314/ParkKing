import { loadPublishGateDatasetValidationContext } from './publishGateDatasetValidationContext'
import { buildPublishGateMetricState } from './publishGateMetricState'
import { validatePublishGateSignOverrideCoverage } from './publishGateSignOverrideValidation'
import { validateDatasetPack } from './publishGateValidation'
import type { PublishGateReportDistrict } from './publishGateTypes'

export const validatePublishGateDistricts = async (
  districts: PublishGateReportDistrict[],
  params: {
    datasetRootDir?: string
    publishedRootDir?: string | null
    strictDiff: boolean
  },
  validateDatasetPackFn: typeof validateDatasetPack = validateDatasetPack,
  loadContextFn: typeof loadPublishGateDatasetValidationContext =
    loadPublishGateDatasetValidationContext,
) =>
  Promise.all(
    districts.map(async (district) => {
      const districtId = district.districtId ?? 'unknown'
      const [extraWarnings, context] = await Promise.all([
        validateDatasetPackFn(
          districtId,
          params.datasetRootDir,
          params.publishedRootDir ?? null,
          params.strictDiff,
        ),
        loadContextFn(districtId, params.datasetRootDir),
      ])
      const signOverrideBreakdown =
        context.status === 'ready'
          ? (() => {
              const metrics = buildPublishGateMetricState(context.meta)
              return {
                total: metrics.signOverridesCount,
                matchedBySegmentId: metrics.signOverrideMatchedSegmentCount,
                matchedBySpatial: metrics.signOverrideSpatialMatchCount,
                unmatchedNamed: metrics.signOverrideUnmatchedNamedCount,
              }
            })()
          : undefined
      const signOverrideWarnings =
        context.status === 'ready'
          ? validatePublishGateSignOverrideCoverage({
              districtId,
              district,
              meta: context.meta,
            })
          : []
      return {
        ...district,
        warnings: [
          ...(district.warnings ?? []),
          ...extraWarnings,
          ...signOverrideWarnings,
        ],
        ...(signOverrideBreakdown ? { signOverrideBreakdown } : {}),
      }
    }),
  )
