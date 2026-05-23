import { describe, expect, it } from 'vitest'
import { buildGateAnomalyPackContext } from './reportGateAnomalyPackContextState'

describe('reportGateAnomalyPackContextState', () => {
  it('builds context state and extracts the matching district diff', () => {
    const context = buildGateAnomalyPackContext({
      districtId: 'xinyi',
      packPath: 'C:/packs/xinyi',
      outPath: 'C:/reports/xinyi.json',
      meta: { districtId: 'xinyi' },
      diffReportPath: 'C:/packs/xinyi/diff_report.json',
      diffReport: {
        schemaVersion: 1,
        generatedAt: '2026-03-02T00:00:00.000Z',
        prevPath: 'C:/packs/prev',
        nextPath: 'C:/packs/xinyi',
        firstPublish: false,
        summary: {
          districtsAdded: [],
          districtsRemoved: [],
          totalChangedFiles: 1,
        },
        districts: [
          {
            districtId: 'xinyi',
            status: 'UPDATED',
            severity: 'WARN',
            issues: [],
            meta: {},
            files: {
              added: [],
              removed: [],
              modified: [],
            },
          },
        ],
      },
      prevPackPath: 'C:/packs/prev',
      nextPackPath: 'C:/packs/xinyi',
      prevPublishedAt: '2026-03-01T00:00:00.000Z',
      nextPublishedAt: '2026-03-02T00:00:00.000Z',
      prevDistrictIds: ['xinyi'],
      nextDistrictIds: ['xinyi'],
    })

    expect(context.packPath).toBe('C:/packs/xinyi')
    expect(context.districtDiff?.status).toBe('UPDATED')
    expect(context.prevPublishedAt).toBe('2026-03-01T00:00:00.000Z')
  })
})
