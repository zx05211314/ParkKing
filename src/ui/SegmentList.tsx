import type { EvaluatedSegment, Tier } from './types'
import { reasonTexts } from '../domain/reasons/reasonText'
import {
  formatReportTimestamp,
  normalizeReportSegmentId,
  type SegmentReport,
} from '../feedback/reports'

export interface SegmentListItem extends EvaluatedSegment {
  distanceMeters?: number
  rankScore?: number
}

interface SegmentListProps {
  segments: SegmentListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  reports?: Record<string, SegmentReport>
}

const tierLabel: Record<Tier, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
}

export const SegmentList = ({
  segments,
  selectedId,
  onSelect,
  reports,
}: SegmentListProps) => {
  return (
    <div className="segment-list">
      <div className="segment-list-header">
        <h2>Nearby segments</h2>
        <span>{segments.length} total</span>
      </div>
      <div className="segment-list-items">
        {segments.map((segment) => {
          const reasonSnippet = segment.reasonCodes && segment.reasonCodes.length > 0
            ? reasonTexts(segment.reasonCodes).slice(0, 2).join(' / ')
            : ''
          const distanceLabel =
            segment.distanceMeters !== undefined
              ? `${(segment.distanceMeters / 1).toFixed(0)} m`
              : '-'
          const report = reports
            ? reports[normalizeReportSegmentId(segment.id)]
            : null
          const reportLabel = report
            ? `${report.status} at ${formatReportTimestamp(report.createdAt)}`
            : null

          return (
            <button
              type="button"
              key={segment.id}
              className={
                segment.id === selectedId
                  ? 'segment-row selected'
                  : 'segment-row'
              }
              onClick={() => onSelect(segment.id)}
            >
              <div className={`tier-badge tier-${segment.tier.toLowerCase()}`}>
                {tierLabel[segment.tier]}
              </div>
              <div className="segment-row-main">
                <div className="segment-row-title">{segment.name}</div>
                <div className="segment-row-meta">
                  <span>{segment.allowedNow.replace('_', ' ')}</span>
                  {segment.sourceType === 'INFERRED' ? <span>Inferred</span> : null}
                  {reasonSnippet ? <span>{reasonSnippet}</span> : null}
                  <span>| {distanceLabel}</span>
                </div>
                {reportLabel ? (
                  <div className="segment-report-badge">{reportLabel}</div>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
