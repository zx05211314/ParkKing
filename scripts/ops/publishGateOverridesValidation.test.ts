import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { validatePublishGateOverridesApplied } from './publishGateOverridesValidation'

const writeGeoJson = async (
  filePath: string,
  features: Array<Record<string, unknown>>,
) => {
  await fs.writeFile(
    filePath,
    JSON.stringify({
      type: 'FeatureCollection',
      features: features.map((properties) => ({
        type: 'Feature',
        properties,
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      })),
    }),
    'utf-8',
  )
}

describe('publishGateOverridesValidation', () => {
  it('flags override count mismatches and invalid override properties', async () => {
    const datasetDir = await fs.mkdtemp(
      path.join(tmpdir(), 'publish-gate-overrides-validation-'),
    )
    await writeGeoJson(path.join(datasetDir, 'red_yellow.geojson'), [{ id: 'seg-1' }])
    await writeGeoJson(path.join(datasetDir, 'candidates_inferred.geojson'), [])
    await writeGeoJson(path.join(datasetDir, 'overrides_applied.geojson'), [
      {
        segmentId: 'missing-segment',
        override_status: 'bad',
        override_schema_version: 9,
      },
    ])

    const warnings = await validatePublishGateOverridesApplied('xinyi', datasetDir, {
      overridesApplied: 2,
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'OVERRIDES_COUNT_MISMATCH' }),
        expect.objectContaining({ code: 'OVERRIDES_SEGMENT_UNKNOWN' }),
        expect.objectContaining({ code: 'OVERRIDES_STATUS_INVALID' }),
        expect.objectContaining({ code: 'OVERRIDES_SCHEMA_UNKNOWN' }),
      ]),
    )
  })
})
