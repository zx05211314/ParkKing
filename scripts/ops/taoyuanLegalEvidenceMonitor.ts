import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runTaoyuanLegalEvidenceProbe,
  type TaoyuanLegalEvidenceProbeResult,
} from './probeTaoyuanLegalEvidence'

const DEFAULT_BASELINE =
  'review-evidence/taoyuan/legal-evidence-baseline.json'
const DEFAULT_SPATIAL = '.tmp/taoyuan-legal-evidence/paid_curb_segments.geojson'
const DEFAULT_PROBE_REPORT = '.tmp/taoyuan-legal-evidence/probe.md'
const DEFAULT_PROBE_JSON = '.tmp/taoyuan-legal-evidence/probe.json'
const DEFAULT_REPORT = '.tmp/taoyuan-legal-evidence/monitor.md'
const DEFAULT_JSON_REPORT = '.tmp/taoyuan-legal-evidence/monitor.json'

export type TaoyuanLegalEvidenceMonitorStatus =
  | 'NO_NEW_LEGAL_EVIDENCE'
  | 'SOURCE_DRIFT'
  | 'LEGAL_EVIDENCE_CANDIDATE'
  | 'PROBE_FAILED'

export interface TaoyuanLegalEvidenceBaseline {
  schemaVersion: 1
  regionId: 'taoyuan'
  approvedSourceSha256: string
  approvedSpatialSha256: string
  sourceUpdatedAt: string
  sourceVersionId: number
  parkingSegmentCount: number
  parkingSpotCount: number
  spatialFeatureCount: number
  segmentGeometryCount: number
  representativePointCount: number
  legalAnswerEligible: false
}

export interface TaoyuanLegalEvidenceMonitorResult {
  schemaVersion: 1
  monitoredAt: string
  status: TaoyuanLegalEvidenceMonitorStatus
  attentionRequired: boolean
  legalEvidenceCandidateDetected: boolean
  sourceDriftDetected: boolean
  legalAnswerEligible: false
  baseline: TaoyuanLegalEvidenceBaseline
  probe: TaoyuanLegalEvidenceProbeResult
  reasons: string[]
  nextActions: string[]
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

export const parseTaoyuanLegalEvidenceBaseline = (
  value: unknown,
): TaoyuanLegalEvidenceBaseline => {
  const baseline =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  if (
    !baseline ||
    baseline.schemaVersion !== 1 ||
    baseline.regionId !== 'taoyuan' ||
    typeof baseline.approvedSourceSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(baseline.approvedSourceSha256) ||
    typeof baseline.approvedSpatialSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(baseline.approvedSpatialSha256) ||
    typeof baseline.sourceUpdatedAt !== 'string' ||
    !Number.isFinite(Date.parse(baseline.sourceUpdatedAt)) ||
    !isNonNegativeInteger(baseline.sourceVersionId) ||
    !isNonNegativeInteger(baseline.parkingSegmentCount) ||
    !isNonNegativeInteger(baseline.parkingSpotCount) ||
    !isNonNegativeInteger(baseline.spatialFeatureCount) ||
    !isNonNegativeInteger(baseline.segmentGeometryCount) ||
    !isNonNegativeInteger(baseline.representativePointCount) ||
    baseline.legalAnswerEligible !== false
  ) {
    throw new Error('Invalid Taoyuan legal evidence monitor baseline')
  }
  return baseline as unknown as TaoyuanLegalEvidenceBaseline
}

const compareCount = (params: {
  label: string
  expected: number
  actual: number | null
}) =>
  params.actual === null
    ? `${params.label} is unavailable; expected ${params.expected}.`
    : params.actual !== params.expected
      ? `${params.label} changed from ${params.expected} to ${params.actual}.`
      : null

export const assessTaoyuanLegalEvidenceMonitor = (params: {
  monitoredAt: string
  baseline: TaoyuanLegalEvidenceBaseline
  probe: TaoyuanLegalEvidenceProbeResult
}): TaoyuanLegalEvidenceMonitorResult => {
  const { baseline, probe } = params
  const parkingSpotCount = probe.endpoints.parkingSpots.count
  const candidateReasons = [
    parkingSpotCount !== null && parkingSpotCount > baseline.parkingSpotCount
      ? `Official TDX ParkingSpot records increased from ${baseline.parkingSpotCount} to ${parkingSpotCount}.`
      : null,
    probe.localSpatial.segmentGeometryCount > baseline.segmentGeometryCount
      ? `Normalized curb-line geometries increased from ${baseline.segmentGeometryCount} to ${probe.localSpatial.segmentGeometryCount}.`
      : null,
  ].filter((value): value is string => Boolean(value))
  const driftReasons = [
    probe.localSpatial.contentSha256 !== baseline.approvedSpatialSha256
      ? `Normalized spatial content SHA-256 changed from ${baseline.approvedSpatialSha256} to ${probe.localSpatial.contentSha256}.`
      : null,
    probe.localSpatial.sourceUpdateTime !== baseline.sourceUpdatedAt
      ? `Official source update time changed from ${baseline.sourceUpdatedAt} to ${probe.localSpatial.sourceUpdateTime ?? 'unavailable'}.`
      : null,
    probe.localSpatial.versionId !== baseline.sourceVersionId
      ? `Official source version changed from ${baseline.sourceVersionId} to ${probe.localSpatial.versionId ?? 'unavailable'}.`
      : null,
    compareCount({
      label: 'Official ParkingSegment records',
      expected: baseline.parkingSegmentCount,
      actual: probe.endpoints.parkingSegments.count,
    }),
    compareCount({
      label: 'Local source records',
      expected: baseline.parkingSegmentCount,
      actual: probe.localSpatial.sourceRecordCount,
    }),
    compareCount({
      label: 'Normalized spatial features',
      expected: baseline.spatialFeatureCount,
      actual: probe.localSpatial.featureCount,
    }),
    compareCount({
      label: 'Representative points',
      expected: baseline.representativePointCount,
      actual: probe.localSpatial.representativePointCount,
    }),
  ].filter((value): value is string => Boolean(value))
  const legalEvidenceCandidateDetected = candidateReasons.length > 0
  const sourceDriftDetected = driftReasons.length > 0
  const status: TaoyuanLegalEvidenceMonitorStatus = !probe.probePass
    ? 'PROBE_FAILED'
    : legalEvidenceCandidateDetected
      ? 'LEGAL_EVIDENCE_CANDIDATE'
      : sourceDriftDetected
        ? 'SOURCE_DRIFT'
        : 'NO_NEW_LEGAL_EVIDENCE'
  const reasons = [
    ...probe.errors.map((error) => `Probe error: ${error}`),
    ...candidateReasons,
    ...driftReasons,
  ]

  return {
    schemaVersion: 1,
    monitoredAt: params.monitoredAt,
    status,
    attentionRequired: status !== 'NO_NEW_LEGAL_EVIDENCE',
    legalEvidenceCandidateDetected,
    sourceDriftDetected,
    legalAnswerEligible: false,
    baseline,
    probe,
    reasons,
    nextActions:
      status === 'LEGAL_EVIDENCE_CANDIDATE'
        ? [
            'Inspect the official probe artifacts and verify geometry precision and authority.',
            'Normalize qualifying official data through docs/taoyuan-legal-evidence-intake.md.',
            'Keep legalAnswerEligible false until the complete candidate and human-review gates pass.',
          ]
        : status === 'SOURCE_DRIFT'
          ? [
              'Refresh the Taoyuan source-text and spatial artifacts from the official endpoints.',
              'Rebuild and re-review affected source rows before updating this baseline.',
              'Do not infer legal curb rules from paid-curb reference drift.',
            ]
          : status === 'PROBE_FAILED'
            ? [
                'Inspect endpoint and local source-count errors in the attached probe report.',
                'Repair acquisition or normalization before updating the approved baseline.',
              ]
            : [
                'No action required; keep Taoyuan reference-only.',
                'Continue scheduled monitoring for official legal-evidence changes.',
              ],
  }
}

export const renderTaoyuanLegalEvidenceMonitor = (
  result: TaoyuanLegalEvidenceMonitorResult,
) =>
  [
    `# Taoyuan legal evidence monitor: ${result.status}`,
    '',
    `- Monitored at: ${result.monitoredAt}`,
    `- Attention required: ${result.attentionRequired ? 'yes' : 'no'}`,
    `- Legal evidence candidate detected: ${result.legalEvidenceCandidateDetected ? 'yes' : 'no'}`,
    `- Source drift detected: ${result.sourceDriftDetected ? 'yes' : 'no'}`,
    '- Eligible for legal parking answers: no',
    `- Approved source SHA-256: ${result.baseline.approvedSourceSha256}`,
    `- Approved spatial SHA-256: ${result.baseline.approvedSpatialSha256}`,
    '',
    '## Counts',
    '',
    '| Signal | Baseline | Current |',
    '| --- | ---: | ---: |',
    `| ParkingSegment records | ${result.baseline.parkingSegmentCount} | ${result.probe.endpoints.parkingSegments.count ?? '-'} |`,
    `| ParkingSpot records | ${result.baseline.parkingSpotCount} | ${result.probe.endpoints.parkingSpots.count ?? '-'} |`,
    `| Spatial features | ${result.baseline.spatialFeatureCount} | ${result.probe.localSpatial.featureCount} |`,
    `| Curb-line geometries | ${result.baseline.segmentGeometryCount} | ${result.probe.localSpatial.segmentGeometryCount} |`,
    `| Representative points | ${result.baseline.representativePointCount} | ${result.probe.localSpatial.representativePointCount} |`,
    '',
    '## Reasons',
    '',
    ...(result.reasons.length > 0
      ? result.reasons.map((reason) => `- ${reason}`)
      : ['- none']),
    '',
    '## Next actions',
    '',
    ...result.nextActions.map((action) => `- ${action}`),
  ].join('\n')

const MONITOR_STATUSES = new Set<TaoyuanLegalEvidenceMonitorStatus>([
  'NO_NEW_LEGAL_EVIDENCE',
  'SOURCE_DRIFT',
  'LEGAL_EVIDENCE_CANDIDATE',
  'PROBE_FAILED',
])

export const parseTaoyuanLegalEvidenceMonitorResult = (
  value: unknown,
): TaoyuanLegalEvidenceMonitorResult => {
  const result =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  const probe =
    result?.probe &&
    typeof result.probe === 'object' &&
    !Array.isArray(result.probe)
      ? (result.probe as Record<string, unknown>)
      : null
  const localSpatial =
    probe?.localSpatial &&
    typeof probe.localSpatial === 'object' &&
    !Array.isArray(probe.localSpatial)
      ? (probe.localSpatial as Record<string, unknown>)
      : null
  if (
    !result ||
    result.schemaVersion !== 1 ||
    typeof result.monitoredAt !== 'string' ||
    !Number.isFinite(Date.parse(result.monitoredAt)) ||
    !MONITOR_STATUSES.has(result.status as TaoyuanLegalEvidenceMonitorStatus) ||
    typeof result.attentionRequired !== 'boolean' ||
    typeof result.legalEvidenceCandidateDetected !== 'boolean' ||
    typeof result.sourceDriftDetected !== 'boolean' ||
    result.legalAnswerEligible !== false ||
    !Array.isArray(result.reasons) ||
    !result.reasons.every((entry) => typeof entry === 'string') ||
    !Array.isArray(result.nextActions) ||
    !result.nextActions.every((entry) => typeof entry === 'string') ||
    !probe ||
    probe.schemaVersion !== 1 ||
    typeof probe.probePass !== 'boolean' ||
    probe.legalAnswerEligible !== false ||
    !localSpatial ||
    typeof localSpatial.contentSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(localSpatial.contentSha256) ||
    (localSpatial.sourceUpdateTime !== null &&
      typeof localSpatial.sourceUpdateTime !== 'string') ||
    (localSpatial.versionId !== null &&
      !isNonNegativeInteger(localSpatial.versionId)) ||
    localSpatial.legalAnswerEligible !== false
  ) {
    throw new Error('Invalid Taoyuan legal evidence monitor result')
  }
  parseTaoyuanLegalEvidenceBaseline(result.baseline)
  return result as unknown as TaoyuanLegalEvidenceMonitorResult
}

const appendGitHubOutput = async (
  githubOutputPath: string | undefined,
  result: TaoyuanLegalEvidenceMonitorResult,
) => {
  if (!githubOutputPath) {
    return
  }
  await fs.appendFile(
    githubOutputPath,
    [
      `status=${result.status}`,
      `attention_required=${String(result.attentionRequired)}`,
      `candidate_detected=${String(result.legalEvidenceCandidateDetected)}`,
      `source_drift_detected=${String(result.sourceDriftDetected)}`,
      '',
    ].join('\n'),
    'utf-8',
  )
}

export const runTaoyuanLegalEvidenceMonitor = async (options: {
  baselinePath?: string
  spatialPath?: string
  probeReportPath?: string
  probeJsonReportPath?: string
  reportPath?: string
  jsonReportPath?: string
  githubOutputPath?: string
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  now?: Date
} = {}) => {
  const baselinePath = path.resolve(options.baselinePath ?? DEFAULT_BASELINE)
  const reportPath = path.resolve(options.reportPath ?? DEFAULT_REPORT)
  const jsonReportPath = path.resolve(
    options.jsonReportPath ?? DEFAULT_JSON_REPORT,
  )
  const now = options.now ?? new Date()
  const baseline = parseTaoyuanLegalEvidenceBaseline(
    JSON.parse(await fs.readFile(baselinePath, 'utf-8')) as unknown,
  )
  const probe = await runTaoyuanLegalEvidenceProbe({
    spatialPath: options.spatialPath ?? DEFAULT_SPATIAL,
    reportPath: options.probeReportPath ?? DEFAULT_PROBE_REPORT,
    jsonReportPath: options.probeJsonReportPath ?? DEFAULT_PROBE_JSON,
    timeoutMs: options.timeoutMs,
    env: options.env,
    fetchImpl: options.fetchImpl,
    now,
  })
  const result = assessTaoyuanLegalEvidenceMonitor({
    monitoredAt: now.toISOString(),
    baseline,
    probe,
  })
  await Promise.all([
    fs.mkdir(path.dirname(reportPath), { recursive: true }),
    fs.mkdir(path.dirname(jsonReportPath), { recursive: true }),
  ])
  await Promise.all([
    fs.writeFile(
      reportPath,
      `${renderTaoyuanLegalEvidenceMonitor(result)}\n`,
      'utf-8',
    ),
    fs.writeFile(
      jsonReportPath,
      `${JSON.stringify(result, null, 2)}\n`,
      'utf-8',
    ),
    appendGitHubOutput(options.githubOutputPath, result),
  ])
  return result
}

const run = async () => {
  const timeoutValue = getArgValue(process.argv, '--timeout-ms')
  const result = await runTaoyuanLegalEvidenceMonitor({
    baselinePath: getArgValue(process.argv, '--baseline') ?? undefined,
    spatialPath: getArgValue(process.argv, '--spatial') ?? undefined,
    probeReportPath: getArgValue(process.argv, '--probe-out') ?? undefined,
    probeJsonReportPath:
      getArgValue(process.argv, '--probe-json-out') ?? undefined,
    reportPath: getArgValue(process.argv, '--out') ?? undefined,
    jsonReportPath: getArgValue(process.argv, '--json-out') ?? undefined,
    githubOutputPath:
      getArgValue(process.argv, '--github-output') ??
      process.env.GITHUB_OUTPUT ??
      undefined,
    timeoutMs: timeoutValue ? Number(timeoutValue) : undefined,
  })
  console.log(renderTaoyuanLegalEvidenceMonitor(result))
  if (result.status === 'PROBE_FAILED') {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
