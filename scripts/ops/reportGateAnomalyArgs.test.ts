import { describe, expect, it } from 'vitest'
import { parseReportGateAnomalyArgs } from './reportGateAnomalyArgs'

describe('parseReportGateAnomalyArgs', () => {
  it('reads district, pack, and out flags', () => {
    expect(
      parseReportGateAnomalyArgs([
        'node',
        'reportGateAnomalies.ts',
        '--district',
        'beta',
        '--pack',
        'data/generated/beta',
        '--out',
        'reports/gate_anomalies_beta.json',
      ]),
    ).toEqual({
      districtId: 'beta',
      packPath: 'data/generated/beta',
      outPath: 'reports/gate_anomalies_beta.json',
    })
  })
})
