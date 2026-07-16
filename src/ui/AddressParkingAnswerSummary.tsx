import { useState } from 'react'
import {
  formatReportTimestamp,
  REPORT_STATUS_LABELS,
  type ReportStatus,
} from '../feedback/reports'
import type { AddressParkingAnswerSummaryProps } from './addressRecommendationsPanelTypes'
import { buildParkingAnswerTrustSummary } from './parkingAnswerPresentation'
import { PaidCurbReferencePanel } from './PaidCurbReferencePanel'

const ANSWER_LABELS = {
  PARK: 'Park allowed at nearest mapped curb',
  TEMP_STOP: 'No parking now; temporary stop only',
  NO_STOP: 'Do not stop or park here',
  NO_DATA: 'No mapped curb answer',
} as const

const ANSWER_ACTIONS = {
  PARK: 'Use this curb only if posted signs still match the mapped rule.',
  TEMP_STOP: 'Do not park here now. Treat this as temporary stopping only.',
  NO_STOP: 'Avoid stopping or parking at this pinned curb.',
  NO_DATA: 'Pick a nearby curb segment or widen the search radius.',
} as const

const getAnswerClass = (kind: keyof typeof ANSWER_LABELS) =>
  `answer-${kind.toLowerCase().replace('_', '-')}`

const EVIDENCE_LABELS = {
  MARKED_SPACE: 'Mapped marked spaces',
  CURB_RULE: 'Mapped curb rule',
  INFERRED: 'Inferred curb',
  NO_DATA: 'No mapped evidence',
} as const

const getServiceNotice = (
  status: AddressParkingAnswerSummaryProps['parkingAnswerServiceStatus'],
  error: string | null,
) => {
  if (status === 'degraded') {
    return error ?? 'Exact answer service data is not ready; showing local dataset fallback.'
  }
  if (status === 'error') {
    return error ?? 'Exact answer service request failed; showing local dataset fallback.'
  }
  if (status === 'unavailable') {
    return error ?? 'Exact answer service is unavailable; showing local dataset fallback.'
  }
  return null
}

export function AddressParkingAnswerSummary({
  parkingAnswer,
  parkingAnswerServiceStatus,
  parkingAnswerServiceError,
  parkingCoverageNotice,
  parkingCoverageReferenceState,
  parkingCoverageReferenceAddressLabel,
  parkingAnswerReport,
  formatDistanceMeters,
  onParkingAnswerReport,
}: AddressParkingAnswerSummaryProps) {
  const [reportNote, setReportNote] = useState('')
  const serviceNotice = getServiceNotice(
    parkingAnswerServiceStatus,
    parkingAnswerServiceError,
  )

  if (parkingCoverageNotice) {
    return (
      <>
        <div className="address-parking-answer answer-no-data">
          <div className="address-parking-answer-header">
            <div>
              <div className="address-best-option-label">Pinned location answer</div>
              <div className="address-parking-answer-title">
                Outside active coverage
              </div>
            </div>
            <div className="address-parking-answer-kind">NOT EVALUATED</div>
          </div>
          <div className="address-parking-answer-action">
            Decision: No parking recommendation was calculated from another district's data.
          </div>
          <div className="address-parking-answer-caveat">
            Coverage: {parkingCoverageNotice}
          </div>
        </div>
        {parkingCoverageReferenceState ? (
          <PaidCurbReferencePanel
            key={parkingCoverageReferenceAddressLabel ?? ''}
            state={parkingCoverageReferenceState}
            addressLabel={parkingCoverageReferenceAddressLabel ?? null}
          />
        ) : null}
      </>
    )
  }

  if (!parkingAnswer) {
    return serviceNotice ? (
      <div className="address-parking-answer answer-no-data">
        <div className="address-parking-answer-header">
          <div>
            <div className="address-best-option-label">Pinned location answer</div>
            <div className="address-parking-answer-title">
              Exact answer unavailable
            </div>
          </div>
          <div className="address-parking-answer-kind">
            {parkingAnswerServiceStatus.replace('_', ' ')}
          </div>
        </div>
        <div className="address-parking-answer-caveat">
          Service: {serviceNotice}
        </div>
      </div>
    ) : null
  }

  const primary = parkingAnswer.primary
  const primaryReason =
    primary?.reasons[0] ?? primary?.reasonCodes[0] ?? parkingAnswer.label
  const evidence = parkingAnswer.evidence
  const nearestDistance = primary
    ? formatDistanceMeters(primary.distanceMeters)
    : `No curb within ${formatDistanceMeters(parkingAnswer.searchRadiusMeters)}`
  const inferredMode = parkingAnswer.includeInferred
    ? 'Inferred candidates included'
    : 'Inferred candidates excluded'
  const trustSummary = buildParkingAnswerTrustSummary(parkingAnswer)
  const handleReport = (status: ReportStatus) => {
    if (!primary) {
      return
    }
    onParkingAnswerReport(status, reportNote)
    setReportNote('')
  }

  return (
    <div className={`address-parking-answer ${getAnswerClass(parkingAnswer.kind)}`}>
      <div className="address-parking-answer-header">
        <div>
          <div className="address-best-option-label">Pinned location answer</div>
          <div className="address-parking-answer-title">
            {ANSWER_LABELS[parkingAnswer.kind]}
          </div>
        </div>
        <div className="address-parking-answer-kind">
          {parkingAnswer.kind.replace('_', ' ')}
        </div>
      </div>
      <div className="address-parking-answer-action">
        Decision: {ANSWER_ACTIONS[parkingAnswer.kind]}
      </div>
      <div
        className={`address-parking-answer-trust trust-${trustSummary.trustTone}`}
      >
        <div>
          <span className="address-parking-answer-trust-label">Trust</span>
          <strong>{trustSummary.trustLabel}</strong>
        </div>
        <div>
          <span className="address-parking-answer-trust-label">Next step</span>
          <strong>{trustSummary.nextStep}</strong>
        </div>
      </div>
      <div className="address-parking-answer-meta">
        {primary ? (
          <>
            <span>{primary.tier}</span>
            <span>{primary.name}</span>
            <span>{formatDistanceMeters(primary.distanceMeters)}</span>
            <span>{primary.finalConfidence} confidence</span>
            {primary.sourceType === 'INFERRED' ? <span>Inferred</span> : null}
            {evidence.kind === 'MARKED_SPACE' ? <span>Space evidence</span> : null}
          </>
        ) : (
          <span>{parkingAnswer.label}</span>
        )}
      </div>
      <div className="address-parking-answer-detail-grid">
        <span>Nearest curb: {nearestDistance}</span>
        <span>Search radius: {formatDistanceMeters(parkingAnswer.searchRadiusMeters)}</span>
        <span>Evidence type: {EVIDENCE_LABELS[evidence.kind]}</span>
        <span>Alternatives checked: {parkingAnswer.alternatives.length}</span>
        <span>{inferredMode}</span>
      </div>
      <div className="address-parking-answer-evidence">
        Evidence: {evidence.label}
      </div>
      <div className="address-parking-answer-evidence-strength">
        Evidence strength: {trustSummary.evidenceStrength}
      </div>
      {serviceNotice ? (
        <div className="address-parking-answer-caveat">
          Service: {serviceNotice}
        </div>
      ) : null}
      {trustSummary.fieldChecks.length > 0 ? (
        <div className="address-parking-answer-checks">
          <div className="address-parking-answer-checks-title">
            Field checks before relying on this:
          </div>
          <ul>
            {trustSummary.fieldChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {primary ? (
        <div className="address-parking-answer-report">
          <div className="address-parking-answer-checks-title">
            Correct this pinned answer
          </div>
          {parkingAnswerReport ? (
            <>
              <div
                className={`feedback-badge feedback-${parkingAnswerReport.status.toLowerCase()}`}
              >
                {REPORT_STATUS_LABELS[parkingAnswerReport.status]}
              </div>
              <div className="address-parking-answer-report-status">
                Latest pinned report:{' '}
                {formatReportTimestamp(parkingAnswerReport.createdAt)}
                {parkingAnswerReport.note ? ` | ${parkingAnswerReport.note}` : ''}
              </div>
            </>
          ) : (
            <div className="address-parking-answer-report-status">
              No pinned report yet
            </div>
          )}
          <div className="segment-report-actions address-parking-answer-report-actions">
            <button type="button" onClick={() => handleReport('LEGAL')}>
              Legal
            </button>
            <button type="button" onClick={() => handleReport('ILLEGAL')}>
              Illegal
            </button>
            <button type="button" onClick={() => handleReport('UNCLEAR')}>
              Unclear
            </button>
          </div>
          <textarea
            rows={3}
            value={reportNote}
            placeholder="Optional evidence note for this pinned curb"
            onChange={(event) => setReportNote(event.target.value)}
          />
        </div>
      ) : null}
      {parkingAnswer.caveats.length > 0 ? (
        <div className="address-parking-answer-caveat">
          Caveats: {parkingAnswer.caveats.join('; ')}
        </div>
      ) : null}
      {primaryReason ? (
        <div className="address-best-option-reason">Why: {primaryReason}</div>
      ) : null}
    </div>
  )
}
