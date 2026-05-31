import type { BBoxDelta } from './diffPackMetrics'
import type { DiffIssue } from './diffPacks'
import { FAIL_DISTRICT_DIFF_THRESHOLDS } from './diffPackDistrictIssueThresholds'

export const buildBoundaryAreaIssues = (params: {
  districtId: string
  boundaryBBox: BBoxDelta
}) => {
  const { districtId, boundaryBBox } = params
  const prevArea = boundaryBBox.area.prev
  const nextArea = boundaryBBox.area.next
  if (
    prevArea === null ||
    nextArea === null ||
    prevArea <= 0 ||
    nextArea > FAIL_DISTRICT_DIFF_THRESHOLDS.bboxNearZeroArea
  ) {
    return []
  }

  return [
    {
      severity: 'FAIL',
      code: 'DIFF_BBOX_COLLAPSE',
      message: `boundaryBBox area collapsed near zero for ${districtId}`,
      metric: { prevArea, nextArea },
      threshold: { minArea: FAIL_DISTRICT_DIFF_THRESHOLDS.bboxNearZeroArea },
    } satisfies DiffIssue,
  ]
}
