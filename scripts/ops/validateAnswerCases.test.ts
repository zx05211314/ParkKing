import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RuntimeCoverageCatalog } from '../../src/data/coverageCatalog'
import type { SmokeExactParkingAnswerCaseFile } from './smokeExactParkingAnswers'
import {
  parseValidateAnswerCasesArgs,
  renderValidateAnswerCasesResult,
  validateAnswerCaseCoverageAreas,
  validateAnswerCaseFile,
  validateAnswerCases,
} from './validateAnswerCases'

const validCaseFile: SmokeExactParkingAnswerCaseFile = {
  schemaVersion: 1,
  districtId: 'xinyi',
  datasetHash: 'hash-1',
  cases: [
    {
      id: 'xinyi-reviewed-legal-seg-1',
      lng: 121.56,
      lat: 25.03,
      hhmm: '21:00',
      searchRadiusMeters: 25,
      expectedKind: 'PARK',
      expectedEvidenceKind: 'MARKED_SPACE',
      expectedPrimarySegmentId: 'seg-1',
      expectedFinalConfidence: 'HIGH',
      minParkingSpaceCount: 1,
    },
  ],
}

const boundaryHash = 'a'.repeat(64)
const coverageCatalog: RuntimeCoverageCatalog = {
  schemaVersion: 1,
  districts: [
    {
      regionId: 'taipei',
      regionName: 'Taipei City',
      districtId: 'beitou',
      districtName: 'Beitou',
      boundaryFeatureId: '63012',
      publishStage: 'production',
      answerCapability: 'full-rule-pipeline',
      requiresHumanReview: false,
      aliases: [
        {
          areaId: 'shipai',
          areaName: 'Shipai',
          coverageMode: 'parent-district',
          standaloneBoundaryRequired: false,
          boundary: {
            kind: 'OFFICIAL_SUBDISTRICT_UNION',
            url: '/data/reference/shipai-boundary.geojson',
            dataSha256: boundaryHash,
            sourceSha256: boundaryHash,
            memberFeatureIds: ['A01'],
            parkingAnswerOwnerDistrictId: 'beitou',
            boundaryBBox: [121.5, 25.1, 121.52, 25.12],
            boundaryGeometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [121.5, 25.1],
                  [121.52, 25.1],
                  [121.52, 25.12],
                  [121.5, 25.12],
                  [121.5, 25.1],
                ],
              ],
            },
          },
        },
      ],
      boundaryBBox: [121.48, 25.08, 121.54, 25.16],
      boundaryGeometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.48, 25.08],
            [121.54, 25.08],
            [121.54, 25.16],
            [121.48, 25.16],
            [121.48, 25.08],
          ],
        ],
      },
    },
  ],
}

describe('validateAnswerCases', () => {
  it('parses strict defaults and local-debug escape hatches', () => {
    expect(
      parseValidateAnswerCasesArgs([
        'node',
        'validateAnswerCases',
        '--cases',
        'configs/prod/*.answer-cases.json',
        '--min-cases',
        '2',
      ]),
    ).toMatchObject({
      casesGlob: 'configs/prod/*.answer-cases.json',
      minCases: 2,
      requirePinned: true,
      requireUiCompatibleTimes: true,
      requirePrimarySegment: true,
      requireEvidenceKind: true,
      requireFinalConfidence: true,
      allowInferredCases: true,
      allowMissing: false,
    })

    expect(
      parseValidateAnswerCasesArgs([
        'node',
        'validateAnswerCases',
        '--allow-unpinned-cases',
        '--allow-non-ui-times',
        '--allow-missing-primary-segment',
        '--allow-missing-evidence-kind',
        '--allow-missing-final-confidence',
        '--disallow-inferred-cases',
        '--allow-missing',
      ]),
    ).toMatchObject({
      requirePinned: false,
      requireUiCompatibleTimes: false,
      requirePrimarySegment: false,
      requireEvidenceKind: false,
      requireFinalConfidence: false,
      allowInferredCases: false,
      allowMissing: true,
    })
  })

  it('passes a pinned reviewed answer case file', () => {
    const issue = validateAnswerCaseFile(
      'configs/prod/xinyi.answer-cases.json',
      validCaseFile,
    )

    expect(issue.errors).toEqual([])
    expect(issue.caseCount).toBe(1)
    expect(renderValidateAnswerCasesResult([issue])).toContain(
      'PASS configs/prod/xinyi.answer-cases.json',
    )
  })

  it('fails for unpinned or weak reviewed case contracts', () => {
    const issue = validateAnswerCaseFile('configs/prod/xinyi.answer-cases.json', {
      ...validCaseFile,
      districtId: 'daan',
      datasetHash: undefined,
      cases: [
        {
          id: 'case-1',
          lng: 121.56,
          lat: 25.03,
          hhmm: '09:00',
          expectedKind: 'PARK',
          includeInferred: true,
        },
        {
          id: 'case-1',
          lng: 121.57,
          lat: 25.04,
          expectedKind: 'NO_STOP',
          expectedEvidenceKind: 'CURB_RULE',
          expectedPrimarySegmentId: 'seg-2',
          expectedFinalConfidence: 'HIGH',
        },
      ],
    })

    expect(issue.errors).toEqual([
      'districtId daan does not match file name xinyi',
      'datasetHash is required',
      'case case-1: hhmm must be 13:00 or 21:00 for publish UI smoke',
      'case case-1: expectedPrimarySegmentId is required',
      'case case-1: expectedEvidenceKind is required',
      'case case-1: expectedFinalConfidence is required',
      'case case-1: duplicate id also used at index 1',
    ])
  })

  it('can still reject inferred cases when strict official-only review is requested', () => {
    const issue = validateAnswerCaseFile(
      'configs/prod/xinyi.answer-cases.json',
      {
        ...validCaseFile,
        cases: [
          {
            ...validCaseFile.cases[0],
            includeInferred: true,
          },
        ],
      },
      { allowInferredCases: false },
    )

    expect(issue.errors).toEqual([
      'case xinyi-reviewed-legal-seg-1: includeInferred=true is not allowed by this validation mode',
    ])
  })

  it('requires coverage-area cases to be inside their owned standalone boundary', () => {
    const caseFile: SmokeExactParkingAnswerCaseFile = {
      ...validCaseFile,
      districtId: 'beitou',
      cases: [
        {
          ...validCaseFile.cases[0],
          id: 'shipai-inside',
          coverageAreaId: 'shipai',
          lng: 121.51,
          lat: 25.11,
        },
        {
          ...validCaseFile.cases[0],
          id: 'shipai-outside',
          coverageAreaId: 'shipai',
          lng: 121.53,
          lat: 25.13,
        },
      ],
    }

    expect(validateAnswerCaseCoverageAreas(caseFile, coverageCatalog)).toEqual([
      'case shipai-outside: location is outside coverage area shipai',
    ])
  })

  it('rejects coverage areas not owned by the answer district', () => {
    expect(
      validateAnswerCaseCoverageAreas(
        {
          ...validCaseFile,
          cases: [
            {
              ...validCaseFile.cases[0],
              coverageAreaId: 'shipai',
            },
          ],
        },
        coverageCatalog,
      ),
    ).toEqual([
      'case xinyi-reviewed-legal-seg-1: coverage area shipai is not owned by district xinyi',
    ])
  })

  it('loads matching files and fails when none match', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-answer-cases-'))
    const casesPath = path.join(base, 'xinyi.answer-cases.json')
    await fs.writeFile(casesPath, JSON.stringify(validCaseFile, null, 2))

    await expect(
      validateAnswerCases({
        casesGlob: path.join(base, '*.answer-cases.json').replace(/\\/g, '/'),
      }),
    ).resolves.toMatchObject({
      hasErrors: false,
      issues: [{ caseCount: 1, errors: [] }],
    })

    await expect(
      validateAnswerCases({
        casesGlob: path.join(base, 'missing*.json').replace(/\\/g, '/'),
      }),
    ).resolves.toMatchObject({
      hasErrors: true,
      issues: [{ caseCount: 0 }],
    })
  })
})
