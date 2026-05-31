import { describe, expect, it } from 'vitest'
import { validateConfigIssue } from './validateConfigValidation'

describe('validateConfigIssue', () => {
  it('flags ciSafe paths outside fixtures and mismatched output districts', () => {
    const issue = validateConfigIssue(
      'configs/xinyi.json',
      {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        ciSafe: true,
        inputs: {
          redYellow: 'data/red_yellow.geojson',
        },
        outputs: {
          districtId: 'daan',
          generatedDir: 'public/data/generated/daan',
        },
      },
      {},
    )

    expect(issue.errors).toContain('inputs.redYellow must live under tests/fixtures/ for ciSafe')
    expect(issue.errors).toContain('outputs.districtId must match districtId')
    expect(issue.errors).toContain('outputs.generatedDir must end with /xinyi')
  })

  it('warns when ops thresholds are missing but config is otherwise valid', () => {
    const issue = validateConfigIssue(
      'configs/xinyi.json',
      {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        inputs: {
          redYellow: 'tests/fixtures/xinyi/red_yellow.geojson',
        },
        ops: {},
      },
      {},
    )

    expect(issue.errors).toEqual([])
    expect(issue.warnings).toContain('ops.thresholds missing; defaults will be used')
  })
})
