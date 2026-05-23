interface DatasetStatusPanelProps {
  districtName: string
  schemaVersion: string | number
  segmentsCount: number
  inferredCount: number
  overrideCount: number
  signOverrideMatchedSegmentCount: number | null
  signOverrideSpatialMatchCount: number | null
  signOverrideUnmatchedNamedCount: number | null
  zonesCount: number
  intersectionCount: number
  crosswalkCount: number
  parkingSpaceCount: number
  modeLabel: string
  builtAtLabel: string
  evaluationStatus: string
  clipCacheSummary: string
  datasetStatus: 'loading' | 'ready' | 'error'
  issueReportSyncLabel: string
  issueReportSyncNote: string
  issueReportStatus: {
    kind: 'success' | 'warning' | 'error'
    message: string
  } | null
  reportingIssue: boolean
  onReportIssue: () => void
  onExportReports: () => void
  onOpenInfo: () => void
}

export function DatasetStatusPanel({
  districtName,
  schemaVersion,
  segmentsCount,
  inferredCount,
  overrideCount,
  signOverrideMatchedSegmentCount,
  signOverrideSpatialMatchCount,
  signOverrideUnmatchedNamedCount,
  zonesCount,
  intersectionCount,
  crosswalkCount,
  parkingSpaceCount,
  modeLabel,
  builtAtLabel,
  evaluationStatus,
  clipCacheSummary,
  datasetStatus,
  issueReportSyncLabel,
  issueReportSyncNote,
  issueReportStatus,
  reportingIssue,
  onReportIssue,
  onExportReports,
  onOpenInfo,
}: DatasetStatusPanelProps) {
  const hasNamedOverrideBreakdown =
    signOverrideMatchedSegmentCount !== null ||
    signOverrideSpatialMatchCount !== null ||
    signOverrideUnmatchedNamedCount !== null
  const issueReportStatusClass =
    issueReportStatus?.kind === 'error'
      ? 'control-meta status-error'
      : issueReportStatus?.kind === 'success'
        ? 'control-meta status-success'
        : issueReportStatus?.kind === 'warning'
          ? 'control-meta status-warning'
          : 'control-meta'

  return (
    <div className="control-group">
      <div className="control-label">Dataset status</div>
      <div className="control-meta">District: {districtName}</div>
      <div className="control-meta">Schema: {schemaVersion}</div>
      <div className="control-meta">Segments: {segmentsCount}</div>
      <div className="control-meta">Inferred: {inferredCount}</div>
      <div className="control-meta">Overrides: {overrideCount}</div>
      {hasNamedOverrideBreakdown ? (
        <div className="control-meta">
          Named override matches: {signOverrideMatchedSegmentCount ?? 0} direct |{' '}
          {signOverrideSpatialMatchCount ?? 0} spatial fallback
        </div>
      ) : null}
      {hasNamedOverrideBreakdown ? (
        <div
          className={
            (signOverrideUnmatchedNamedCount ?? 0) > 0
              ? 'control-meta status-warning'
              : 'control-meta'
          }
        >
          Named overrides unmatched: {signOverrideUnmatchedNamedCount ?? 0}
        </div>
      ) : null}
      <div className="control-meta">Zones: {zonesCount}</div>
      <div className="control-meta">Intersections: {intersectionCount}</div>
      <div className="control-meta">Crosswalks: {crosswalkCount}</div>
      <div className="control-meta">Parking spaces: {parkingSpaceCount}</div>
      <div className="control-meta">Mode: {modeLabel}</div>
      <div className="control-meta">Built: {builtAtLabel}</div>
      <div className="control-meta">Eval: {evaluationStatus}</div>
      <div className="control-meta">Cache: {clipCacheSummary}</div>
      <div className="control-meta">Issue report sync: {issueReportSyncLabel}</div>
      <div className="control-meta">{issueReportSyncNote}</div>
      <div
        className={
          datasetStatus === 'error' ? 'control-meta status-error' : 'control-meta'
        }
      >
        Status: {datasetStatus}
      </div>
      <button
        type="button"
        className="sheet-close"
        style={{ marginTop: '8px' }}
        disabled={reportingIssue}
        onClick={onReportIssue}
      >
        {reportingIssue ? 'Reporting issue...' : 'Report issue'}
      </button>
      {issueReportStatus ? (
        <div className={issueReportStatusClass}>{issueReportStatus.message}</div>
      ) : null}
      <button
        type="button"
        className="sheet-close"
        style={{ marginTop: '8px' }}
        onClick={onExportReports}
      >
        Export reports
      </button>
      <button
        type="button"
        className="sheet-close"
        style={{ marginTop: '8px' }}
        onClick={onOpenInfo}
      >
        Dataset Info
      </button>
    </div>
  )
}
