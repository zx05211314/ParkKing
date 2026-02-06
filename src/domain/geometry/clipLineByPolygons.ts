import { along, booleanPointInPolygon, length, lineSplit, lineString, point } from '@turf/turf'
import type { Feature, LineString, MultiPolygon, Point, Polygon } from 'geojson'

export interface ClippedLine {
  line: [number, number][]
  insideAnyPolygon: boolean
}

const midpointOnLine = (line: Feature<LineString>): Feature<Point> => {
  const lineLength = length(line, { units: 'kilometers' })
  if (lineLength === 0) {
    return point(line.geometry.coordinates[0])
  }
  return along(line, lineLength / 2, { units: 'kilometers' })
}

const splitByPolygon = (
  line: Feature<LineString>,
  polygon: Feature<Polygon | MultiPolygon>,
): Feature<LineString>[] => {
  const split = lineSplit(line, polygon)
  if (split.features.length === 0) {
    return [line]
  }
  return split.features as Feature<LineString>[]
}

export const clipLineByPolygons = (
  polyline: [number, number][],
  polygons: Array<Feature<Polygon | MultiPolygon>>,
): ClippedLine[] => {
  if (polyline.length < 2) {
    return []
  }

  if (polygons.length === 0) {
    return [{ line: polyline, insideAnyPolygon: false }]
  }

  let lines: Feature<LineString>[] = [lineString(polyline)]

  polygons.forEach((polygon) => {
    lines = lines.flatMap((line) => splitByPolygon(line, polygon))
  })

  return lines.map((line) => {
    const midPoint = midpointOnLine(line)
    const insideAnyPolygon = polygons.some((polygon) =>
      booleanPointInPolygon(midPoint, polygon),
    )

    return {
      line: line.geometry.coordinates.map(
        (coord) => [coord[0], coord[1]] as [number, number],
      ),
      insideAnyPolygon,
    }
  })
}
