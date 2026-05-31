export type MapBounds = [[number, number], [number, number]]

export interface BoundsBBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const boundsFromBBox = (bbox?: BoundsBBox | null): MapBounds | null => {
  if (!bbox) {
    return null
  }
  return [
    [bbox.minX, bbox.minY],
    [bbox.maxX, bbox.maxY],
  ]
}

export const boundsFromPath = (path: [number, number][]): MapBounds | null => {
  if (path.length === 0) {
    return null
  }

  let minX = path[0][0]
  let minY = path[0][1]
  let maxX = path[0][0]
  let maxY = path[0][1]

  path.forEach(([lng, lat]) => {
    minX = Math.min(minX, lng)
    minY = Math.min(minY, lat)
    maxX = Math.max(maxX, lng)
    maxY = Math.max(maxY, lat)
  })

  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

export const expandBounds = (
  bounds: MapBounds,
  minimumSpanDegrees = 0.0008,
): MapBounds => {
  const [[minX, minY], [maxX, maxY]] = bounds
  const width = maxX - minX
  const height = maxY - minY
  const padX = width >= minimumSpanDegrees ? 0 : (minimumSpanDegrees - width) / 2
  const padY = height >= minimumSpanDegrees ? 0 : (minimumSpanDegrees - height) / 2

  return [
    [minX - padX, minY - padY],
    [maxX + padX, maxY + padY],
  ]
}
