import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { featureCollection, lineString, point } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import { countNearbyZonePoints, loadZonePoints } from './ingestCandidateZones'

describe('ingestCandidateZones', () => {
  it('loads representative zone points from generated files', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'candidate-zones-'))
    const generatedDir = path.join(baseDir, 'generated')
    await fs.mkdir(generatedDir, { recursive: true })

    await fs.writeFile(
      path.join(generatedDir, 'bus_stops.geojson'),
      JSON.stringify(featureCollection([point([121.5, 25.0])])),
      'utf-8',
    )
    await fs.writeFile(
      path.join(generatedDir, 'intersections.geojson'),
      JSON.stringify(
        featureCollection([
          lineString([
            [121.6, 25.1],
            [121.7, 25.2],
            [121.8, 25.3],
          ]),
        ]),
      ),
      'utf-8',
    )

    const zonePoints = await loadZonePoints({
      outputs: {
        generatedDir,
      },
    } as never)

    expect(zonePoints).toEqual([
      [121.5, 25.0],
      [121.7, 25.2],
    ])
  })

  it('counts nearby zone points within a radius', () => {
    expect(countNearbyZonePoints(null, [[121.5, 25.0]], 25)).toBe(0)
    expect(
      countNearbyZonePoints(
        [121.5, 25.0],
        [
          [121.5, 25.0],
          [121.50001, 25.00001],
          [121.5, 25.0004],
        ],
        25,
      ),
    ).toBe(2)
  })
})
