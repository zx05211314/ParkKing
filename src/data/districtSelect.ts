export interface DistrictBBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface DistrictBoundaryInfo {
  districtId: string
  boundaryBBox?: DistrictBBox | null
  boundaryCenter?: [number, number] | null
}

const bboxContains = (bbox: DistrictBBox, location: [number, number]) => {
  const [lon, lat] = location
  return (
    lon >= bbox.minX &&
    lon <= bbox.maxX &&
    lat >= bbox.minY &&
    lat <= bbox.maxY
  )
}

const centerFromBBox = (bbox: DistrictBBox): [number, number] => {
  return [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2]
}

const distanceSq = (a: [number, number], b: [number, number]) => {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

export const selectDistrictByLocation = (
  districts: DistrictBoundaryInfo[],
  location: [number, number],
): string | null => {
  if (!location || districts.length === 0) {
    return null
  }

  const candidates = districts
    .map((district) => {
      const bbox = district.boundaryBBox ?? null
      const center =
        district.boundaryCenter ??
        (bbox ? centerFromBBox(bbox) : null)
      return {
        districtId: district.districtId,
        bbox,
        center,
      }
    })
  const withCenter = candidates.filter(
    (entry): entry is { districtId: string; bbox: DistrictBBox | null; center: [number, number] } =>
      Boolean(entry.center),
  )

  if (withCenter.length === 0) {
    return null
  }

  const containing = withCenter.filter((entry) =>
    entry.bbox ? bboxContains(entry.bbox, location) : false,
  )
  const pool = containing.length > 0 ? containing : withCenter

  let selectedId: string | null = null
  let selectedDistance = Number.POSITIVE_INFINITY
  pool.forEach((entry) => {
    const center = entry.center as [number, number]
    const distance = distanceSq(location, center)
    if (
      selectedId === null ||
      distance < selectedDistance ||
      (distance === selectedDistance && entry.districtId < selectedId)
    ) {
      selectedId = entry.districtId
      selectedDistance = distance
    }
  })

  return selectedId
}
