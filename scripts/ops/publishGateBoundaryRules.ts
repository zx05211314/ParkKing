import type { GateWarning } from './publishGateTypes'

const buildGateWarning = (warning: GateWarning): GateWarning => warning

export const validatePublishGateBoundaryMetadata = (
  districtId: string,
  meta: Record<string, unknown>,
) => {
  const warnings: GateWarning[] = []
  const boundaryBBox = meta.boundaryBBox as
    | { minX?: unknown; minY?: unknown; maxX?: unknown; maxY?: unknown }
    | undefined
  const boundaryBBoxValid =
    boundaryBBox &&
    typeof boundaryBBox.minX === 'number' &&
    typeof boundaryBBox.minY === 'number' &&
    typeof boundaryBBox.maxX === 'number' &&
    typeof boundaryBBox.maxY === 'number'
  if (!boundaryBBoxValid) {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_BOUNDARY_BBOX_MISSING',
        message: `boundaryBBox missing in dataset_meta for ${districtId}`,
      }),
    )
  }

  const boundaryCenter = meta.boundaryCenter
  const boundaryCenterValid =
    Array.isArray(boundaryCenter) &&
    boundaryCenter.length === 2 &&
    boundaryCenter.every((value) => typeof value === 'number')
  if (!boundaryCenterValid) {
    warnings.push(
      buildGateWarning({
        severity: 'FAIL',
        code: 'META_BOUNDARY_CENTER_MISSING',
        message: `boundaryCenter missing or invalid in dataset_meta for ${districtId}`,
      }),
    )
  }

  if (boundaryCenterValid && boundaryBBoxValid) {
    const [centerX, centerY] = boundaryCenter as number[]
    if (
      centerX < (boundaryBBox.minX as number) ||
      centerX > (boundaryBBox.maxX as number) ||
      centerY < (boundaryBBox.minY as number) ||
      centerY > (boundaryBBox.maxY as number)
    ) {
      warnings.push(
        buildGateWarning({
          severity: 'FAIL',
          code: 'META_BOUNDARY_CENTER_OUTSIDE',
          message: `boundaryCenter falls outside boundaryBBox for ${districtId}`,
        }),
      )
    }
  }

  return warnings
}
