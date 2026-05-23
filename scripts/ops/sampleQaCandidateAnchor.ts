import { MOCK_LOCATION } from '../../src/map/geo'
import type { DatasetMeta } from '../../src/data/segmentBuilder'

export const toQaAnchorLocation = (meta: DatasetMeta | null): [number, number] => {
  const center = meta?.boundaryCenter
  if (!Array.isArray(center) || center.length !== 2) {
    return MOCK_LOCATION
  }
  const lon = Number(center[0])
  const lat = Number(center[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return MOCK_LOCATION
  }
  return [lon, lat]
}
