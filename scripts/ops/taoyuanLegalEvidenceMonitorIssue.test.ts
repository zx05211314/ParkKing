import { describe, expect, it } from 'vitest'
import type { TaoyuanLegalEvidenceProbeResult } from './probeTaoyuanLegalEvidence'
import {
  TAOYUAN_LEGAL_EVIDENCE_ISSUE_TITLE,
  buildTaoyuanLegalEvidenceIssueBody,
  syncTaoyuanLegalEvidenceIssue,
} from './taoyuanLegalEvidenceMonitorIssue'
import type {
  TaoyuanLegalEvidenceBaseline,
  TaoyuanLegalEvidenceMonitorResult,
} from './taoyuanLegalEvidenceMonitor'
import type { NightlyGitHubApiRequester } from './notifyNightlyIssueSync'

const baseline: TaoyuanLegalEvidenceBaseline = {
  schemaVersion: 1,
  regionId: 'taoyuan',
  approvedSourceSha256: 'a'.repeat(64),
  approvedSpatialSha256: 'b'.repeat(64),
  sourceUpdatedAt: '2026-07-18T00:00:00.000Z',
  sourceVersionId: 1,
  parkingSegmentCount: 944,
  parkingSpotCount: 0,
  spatialFeatureCount: 944,
  segmentGeometryCount: 0,
  representativePointCount: 944,
  legalAnswerEligible: false,
}

const probe = {
  schemaVersion: 1,
  probedAt: '2026-07-19T00:00:00.000Z',
  probePass: true,
  acquisitionMode: 'guest',
  endpoints: {
    parkingSegments: {
      id: 'parking-segments',
      url: 'https://example.test/segments',
      status: 200,
      count: 944,
      sampleFields: [],
      error: null,
    },
    parkingSpots: {
      id: 'parking-spots',
      url: 'https://example.test/spots',
      status: 200,
      count: 1,
      sampleFields: [],
      error: null,
    },
  },
  localSpatial: {
    path: 'spatial.geojson',
    contentSha256: 'b'.repeat(64),
    sourceUpdateTime: '2026-07-18T00:00:00.000Z',
    versionId: 1,
    sourceRecordCount: 944,
    featureCount: 944,
    segmentGeometryCount: 0,
    representativePointCount: 944,
    legalAnswerEligible: false,
  },
  referenceAvailable: true,
  legalAnswerEligible: false,
  errors: [],
  legalAnswerBlockers: [],
  nextActions: [],
} satisfies TaoyuanLegalEvidenceProbeResult

const makeResult = (
  attentionRequired: boolean,
): TaoyuanLegalEvidenceMonitorResult => ({
  schemaVersion: 1,
  monitoredAt: '2026-07-19T00:00:00.000Z',
  status: attentionRequired
    ? 'LEGAL_EVIDENCE_CANDIDATE'
    : 'NO_NEW_LEGAL_EVIDENCE',
  attentionRequired,
  legalEvidenceCandidateDetected: attentionRequired,
  sourceDriftDetected: false,
  legalAnswerEligible: false,
  baseline,
  probe,
  reasons: attentionRequired ? ['Official ParkingSpot records increased.'] : [],
  nextActions: [],
})

const response = (value: unknown) => ({
  json: async () => value,
})

describe('taoyuanLegalEvidenceMonitorIssue', () => {
  it('builds a safe issue body with artifact links and no eligibility claim', () => {
    const body = buildTaoyuanLegalEvidenceIssueBody({
      result: makeResult(true),
      runUrl: 'https://github.test/run/1',
      artifactUrl: 'https://github.test/artifact/1',
    })

    expect(body).toContain('LEGAL_EVIDENCE_CANDIDATE')
    expect(body).toContain('Legal-answer eligible: no')
    expect(body).toContain('https://github.test/artifact/1')
  })

  it('creates one issue when attention is first required', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const requestApi: NightlyGitHubApiRequester = async (url, _token, init) => {
      calls.push({ url, init })
      return response(calls.length === 1 ? [] : { number: 71 })
    }

    await expect(
      syncTaoyuanLegalEvidenceIssue({
        token: 'token',
        repo: 'openai/parkking',
        result: makeResult(true),
        requestApi,
      }),
    ).resolves.toEqual({ action: 'created', issueNumber: 71 })
    expect(calls[1]?.init?.body).toContain(
      TAOYUAN_LEGAL_EVIDENCE_ISSUE_TITLE,
    )
  })

  it('comments on the existing monitor issue instead of duplicating it', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const requestApi: NightlyGitHubApiRequester = async (url, _token, init) => {
      calls.push({ url, init })
      return response(
        calls.length === 1
          ? [{ number: 72, title: TAOYUAN_LEGAL_EVIDENCE_ISSUE_TITLE }]
          : {},
      )
    }

    await expect(
      syncTaoyuanLegalEvidenceIssue({
        token: 'token',
        repo: 'openai/parkking',
        result: makeResult(true),
        requestApi,
      }),
    ).resolves.toEqual({ action: 'commented', issueNumber: 72 })
    expect(calls[1]?.url).toContain('/issues/72/comments')
  })

  it('closes a stale monitor issue after the baseline state returns', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const requestApi: NightlyGitHubApiRequester = async (url, _token, init) => {
      calls.push({ url, init })
      return response(
        calls.length === 1
          ? [{ number: 73, title: TAOYUAN_LEGAL_EVIDENCE_ISSUE_TITLE }]
          : {},
      )
    }

    await expect(
      syncTaoyuanLegalEvidenceIssue({
        token: 'token',
        repo: 'openai/parkking',
        result: makeResult(false),
        requestApi,
      }),
    ).resolves.toEqual({ action: 'closed', issueNumber: 73 })
    expect(calls[1]?.url).toContain('/issues/73/comments')
    expect(calls[2]).toMatchObject({
      url: 'https://api.github.com/repos/openai/parkking/issues/73',
      init: { method: 'PATCH' },
    })
  })

  it('does nothing when the source is unchanged and no issue is open', async () => {
    const requestApi: NightlyGitHubApiRequester = async () => response([])
    await expect(
      syncTaoyuanLegalEvidenceIssue({
        token: 'token',
        repo: 'openai/parkking',
        result: makeResult(false),
        requestApi,
      }),
    ).resolves.toEqual({ action: 'noop', issueNumber: null })
  })
})
