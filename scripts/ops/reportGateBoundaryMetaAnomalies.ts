import type { GateAnomalyReport } from './reportGateAnomalyTypes'
import { parseBBox, parseCenter } from './reportGateGeometryParsing'

export const buildBoundaryMetaAnomalies = (
  meta: Record<string, unknown>,
): GateAnomalyReport['bboxCenterAnomalies'] => {
  const anomalies: GateAnomalyReport['bboxCenterAnomalies'] = []
  const boundaryBBox = parseBBox(meta.boundaryBBox)
  const boundaryCenter = parseCenter(meta.boundaryCenter)

  if (!boundaryBBox) {
    anomalies.push({
      severity: 'FAIL',
      code: 'BOUNDARY_BBOX_MISSING',
      message: 'boundaryBBox is missing or invalid in dataset_meta',
    })
  }
  if (!boundaryCenter) {
    anomalies.push({
      severity: 'FAIL',
      code: 'BOUNDARY_CENTER_MISSING',
      message: 'boundaryCenter is missing or invalid in dataset_meta',
    })
  }

  if (boundaryBBox && boundaryCenter) {
    const [x, y] = boundaryCenter
    const outside =
      x < boundaryBBox.minX ||
      x > boundaryBBox.maxX ||
      y < boundaryBBox.minY ||
      y > boundaryBBox.maxY
    if (outside) {
      anomalies.push({
        severity: 'FAIL',
        code: 'BOUNDARY_CENTER_OUTSIDE_BBOX',
        message: 'boundaryCenter falls outside boundaryBBox',
        metric: {
          boundaryCenter,
          boundaryBBox,
        },
      })
    }
  }

  const area = boundaryBBox
    ? Math.max(
        0,
        (boundaryBBox.maxX - boundaryBBox.minX) * (boundaryBBox.maxY - boundaryBBox.minY),
      )
    : null
  if (area !== null && area <= 1e-10) {
    anomalies.push({
      severity: 'FAIL',
      code: 'BOUNDARY_BBOX_NEAR_ZERO',
      message: 'boundaryBBox area is near zero',
      metric: { area },
    })
  }

  return anomalies
}
