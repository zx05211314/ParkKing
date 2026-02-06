import { booleanIntersects, lineString } from '@turf/turf'
import type { Segment } from '../../ui/types'
import type { Zone } from './zoneTypes'

export const segmentIntersectsZone = (
  segment: Segment,
  zone: Zone,
): boolean => {
  if (segment.path.length < 2) {
    return false
  }
  return booleanIntersects(lineString(segment.path), zone.polygon)
}

export const lineIntersectsZone = (
  line: [number, number][],
  zone: Zone,
): boolean => {
  if (line.length < 2) {
    return false
  }
  return booleanIntersects(lineString(line), zone.polygon)
}

export const findIntersectingZones = (
  segment: Segment,
  zones: Zone[],
): Zone[] => {
  return zones.filter((zone) => segmentIntersectsZone(segment, zone))
}

export const findIntersectingZonesForLine = (
  line: [number, number][],
  zones: Zone[],
): Zone[] => {
  return zones.filter((zone) => lineIntersectsZone(line, zone))
}
