import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  validateIntersectionsReport,
  validateMeta,
  validateMetaFiles,
} from './validateOutputMetadata'

describe('validateOutputMetadata', () => {
  it('reports missing required dataset meta fields', () => {
    const errors: string[] = []
    validateMeta({}, errors)

    expect(errors.some((entry) => entry.includes('missing required field: schemaVersion'))).toBe(
      true,
    )
    expect(errors.some((entry) => entry.includes('counts.parkingSpaces is required'))).toBe(true)
  })

  it('validates file map entries against disk state', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'validate-meta-files-'))
    const redYellowPath = path.join(base, 'red_yellow.geojson')
    await fs.writeFile(redYellowPath, '{"type":"FeatureCollection","features":[]}', 'utf-8')

    const errors: string[] = []
    await validateMetaFiles(
      base,
      {
        files: {
          'red_yellow.geojson': {
            sha256: '',
            bytes: 0,
          },
          'unexpected.geojson': {
            sha256: 'abc',
            bytes: 1,
          },
        },
      },
      errors,
    )

    expect(errors.some((entry) => entry.includes('unexpected entry'))).toBe(true)
    expect(errors.some((entry) => entry.includes('bytes must be > 0'))).toBe(true)
    expect(errors.some((entry) => entry.includes('sha256 missing'))).toBe(true)
  })

  it('validates intersections report structure', () => {
    const errors: string[] = []
    validateIntersectionsReport({}, errors)
    expect(errors).toContain('[intersections_report] counts.finalIntersections is required')
    expect(errors).toContain('[intersections_report] angleSpreadHistogram is required')
  })
})
