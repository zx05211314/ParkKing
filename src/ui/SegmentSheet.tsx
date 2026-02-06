import { useState } from 'react'
import type { EvaluatedSegment } from './types'
import { reasonText } from '../domain/reasons/reasonText'
import type { RankBreakdown, RiskMode } from '../domain/ranking/rank'
import {
  formatReportTimestamp,
  type ReportStatus,
  type SegmentReport,
} from '../feedback/reports'

interface SegmentSheetProps {
  segment: EvaluatedSegment | null
  nowHHMM: string
  onClose: () => void
  distanceMeters?: number | null
  rankBreakdown?: RankBreakdown | null
  riskMode?: RiskMode
  latestReport?: SegmentReport | null
  onReport?: (status: ReportStatus, note: string) => void
}

const formatFreshness = (value: number | null) => {
  if (value === null) {
    return 'Unknown'
  }
  return `${value} days`
}

const formatOverrideSource = (value?: string) => {
  if (!value) {
    return null
  }
  if (value === 'segmentId') {
    return 'Segment ID'
  }
  if (value === 'spatial') {
    return 'Spatial match'
  }
  if (value === 'dataset') {
    return 'Dataset'
  }
  return value
}

const formatOverrideDate = (value?: string) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString()
}

const formatScore = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

const formatDistance = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-'
  }
  return `${Math.round(value)} m`
}

const riskModeLabel = (value?: RiskMode) => {
  if (!value) {
    return null
  }
  if (value === 'CONSERVATIVE') {
    return 'Conservative'
  }
  if (value === 'AGGRESSIVE') {
    return 'Aggressive'
  }
  return 'Neutral'
}

export const SegmentSheet = ({
  segment,
  nowHHMM,
  onClose,
  distanceMeters,
  rankBreakdown,
  riskMode,
  latestReport,
  onReport,
}: SegmentSheetProps) => {
  const [note, setNote] = useState('')

  const handleReport = (status: ReportStatus) => {
    if (!onReport) {
      return
    }
    onReport(status, note)
    setNote('')
  }

  return (
    <div className={segment ? 'segment-sheet open' : 'segment-sheet'}>
      <div className="segment-sheet-header">
        <div>
          <div className="segment-sheet-title">
            {segment ? segment.name : 'No segment selected'}
          </div>
          <div className="segment-sheet-subtitle">Time context: {nowHHMM}</div>
        </div>
        {segment ? (
          <button type="button" className="sheet-close" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      {segment ? (
        <div className="segment-sheet-content">
          <div className="segment-sheet-grid">
            <div>
              <div className="segment-sheet-label">Allowed now</div>
              <div className="segment-sheet-value">
                {segment.allowedNow.replace('_', ' ')}
              </div>
            </div>
            <div>
              <div className="segment-sheet-label">Tier</div>
              <div className={`tier-pill tier-${segment.tier.toLowerCase()}`}>
                {segment.tier}
              </div>
            </div>
            <div>
              <div className="segment-sheet-label">Curb marking</div>
              <div className="segment-sheet-value">{segment.curbMarking}</div>
            </div>
            <div>
              <div className="segment-sheet-label">Coverage</div>
              <div className="segment-sheet-value">
                {segment.coverageConfidence}
              </div>
            </div>
            <div>
              <div className="segment-sheet-label">Override confidence</div>
              <div className="segment-sheet-value">
                {segment.overrideConfidence}
              </div>
            </div>
            <div>
              <div className="segment-sheet-label">Final confidence</div>
              <div className="segment-sheet-value">
                {segment.finalConfidence}
              </div>
            </div>
            <div>
              <div className="segment-sheet-label">Reliability</div>
              <div className="segment-sheet-value">
                {segment.sourceReliability}
              </div>
            </div>
            <div>
              <div className="segment-sheet-label">Freshness</div>
              <div className="segment-sheet-value">
                {formatFreshness(segment.dataFreshnessDays)}
              </div>
            </div>
          </div>

          <div className="segment-sheet-section">
            <div className="segment-sheet-label">Triggered rules</div>
            <ul>
              {segment.reasonCodes && segment.reasonCodes.length > 0 ? (
                segment.reasonCodes.map((code) => (
                  <li key={code}>
                    {code}: {reasonText(code)}
                  </li>
                ))
              ) : segment.reasons && segment.reasons.length > 0 ? (
                segment.reasons.map((reason) => <li key={reason}>{reason}</li>)
              ) : (
                <li>-</li>
              )}
            </ul>
          </div>

          {rankBreakdown ? (
            <div className="segment-sheet-section">
              <div className="segment-sheet-label">
                Penalties &amp; bonuses
                {riskMode ? ` (${riskModeLabel(riskMode)})` : ''}
              </div>
              <ul>
                <li>Distance weight: {formatScore(rankBreakdown.distanceWeight)}</li>
                <li>Tier weight: {formatScore(rankBreakdown.tierWeight)}</li>
                <li>Confidence weight: {formatScore(rankBreakdown.confidenceWeight)}</li>
                <li>Inferred penalty: {formatScore(rankBreakdown.inferredPenalty)}</li>
                <li>Freshness bonus: {formatScore(rankBreakdown.freshnessBonus)}</li>
                <li>Zone density penalty: {formatScore(rankBreakdown.zoneDensityPenalty)}</li>
                <li>Total score: {formatScore(rankBreakdown.total)}</li>
                <li>Distance: {formatDistance(distanceMeters)}</li>
              </ul>
            </div>
          ) : null}

          {segment.riskTags && segment.riskTags.length > 0 ? (
            <div className="segment-sheet-section">
              <div className="segment-sheet-label">Risk tags</div>
              <ul>
                {segment.riskTags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {segment.signOverride ? (
            <div className="segment-sheet-section">
              <div className="segment-sheet-label">
                Override: {segment.signOverride.note}
              </div>
              {segment.signOverride.source ? (
                <div className="segment-sheet-value">
                  Source: {formatOverrideSource(segment.signOverride.source)}
                </div>
              ) : null}
              {segment.signOverride.verifiedAt ? (
                <div className="segment-sheet-value">
                  Verified: {formatOverrideDate(segment.signOverride.verifiedAt)}
                </div>
              ) : null}
              {segment.signOverride.timeWindows.length === 0 ? (
                <div className="segment-sheet-value">-</div>
              ) : (
                <div className="time-windows">
                  {segment.signOverride.timeWindows.map((window) => (
                    <div key={window.label} className="time-window">
                      <span>{window.label}</span>
                      <span>
                        {window.startHHMM}-{window.endHHMM}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="segment-sheet-section">
            <div className="segment-sheet-label">Report feedback</div>
            {latestReport ? (
              <div className="segment-report-status">
                Latest: {latestReport.status} at {formatReportTimestamp(latestReport.createdAt)}
              </div>
            ) : (
              <div className="segment-report-status">No reports yet</div>
            )}
            <div className="segment-report-actions">
              <button
                type="button"
                onClick={() => handleReport('LEGAL')}
                disabled={!segment || !onReport}
              >
                Legal
              </button>
              <button
                type="button"
                onClick={() => handleReport('ILLEGAL')}
                disabled={!segment || !onReport}
              >
                Illegal
              </button>
              <button
                type="button"
                onClick={() => handleReport('UNCLEAR')}
                disabled={!segment || !onReport}
              >
                Unclear
              </button>
            </div>
            <textarea
              rows={3}
              value={note}
              placeholder="Optional note"
              onChange={(event) => setNote(event.target.value)}
              disabled={!segment || !onReport}
            />
          </div>

          <div className="segment-sheet-section">
            <div className="segment-sheet-label">Time windows</div>
            {segment.timeWindows.length === 0 ? (
              <div className="segment-sheet-value">-</div>
            ) : (
              <div className="time-windows">
                {segment.timeWindows.map((window) => (
                  <div key={window.label} className="time-window">
                    <span>{window.label}</span>
                    <span>
                      {window.startHHMM}-{window.endHHMM}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="segment-sheet-empty">
          Tap a curb segment to see its rules and confidence.
        </div>
      )}
    </div>
  )
}

