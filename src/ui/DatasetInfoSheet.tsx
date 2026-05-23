import type { DatasetInfoModel } from './datasetInfo/model'

interface DatasetInfoSheetProps {
  open: boolean
  info: DatasetInfoModel | null
  onClose: () => void
}

export const DatasetInfoSheet = ({ open, info, onClose }: DatasetInfoSheetProps) => {
  if (!open) {
    return null
  }

  return (
    <div className="info-modal">
      <div className="info-modal-card">
        <div className="info-modal-header">
          <div>
            <div className="segment-sheet-title">Dataset Info</div>
            <div className="segment-sheet-subtitle">
              {info?.districtName ?? '-'}
            </div>
          </div>
          <button type="button" className="sheet-close" onClick={onClose}>
            Close
          </button>
        </div>

        {info ? (
          <div className="segment-sheet-content">
            <div className="segment-sheet-grid">
              <div>
                <div className="segment-sheet-label">District ID</div>
                <div className="segment-sheet-value">{info.districtId}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Data source</div>
                <div className="segment-sheet-value">{info.dataSource}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Schema</div>
                <div className="segment-sheet-value">{info.schemaVersion}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Dataset hash</div>
                <div className="segment-sheet-value">{info.datasetHash}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Config hash</div>
                <div className="segment-sheet-value">{info.configHash}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Generated</div>
                <div className="segment-sheet-value">{info.generatedAt}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Published</div>
                <div className="segment-sheet-value">{info.publishedAt}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Meta sha</div>
                <div className="segment-sheet-value">{info.metaSha256}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Pack sha</div>
                <div className="segment-sheet-value">{info.packSha256}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Total bytes</div>
                <div className="segment-sheet-value">{info.totalBytes}</div>
              </div>
              <div>
                <div className="segment-sheet-label">Gate</div>
                <div className="segment-sheet-value">{info.gateResult}</div>
              </div>
            </div>

            <div className="segment-sheet-section">
              <div className="segment-sheet-label">Top anomalies</div>
              <ul>
                {info.anomalies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="segment-sheet-section">
              <div className="segment-sheet-label">Dataset health</div>
              <div className="health-badges">
                {info.health.warnings.length > 0 ? (
                  info.health.warnings.map((warning) => (
                    <span key={warning} className="health-badge health-badge-warn">
                      {warning}
                    </span>
                  ))
                ) : (
                  <span className="health-badge health-badge-ok">OK</span>
                )}
              </div>
              {info.health.deltas.length > 0 ? (
                <>
                  <div className="segment-sheet-label">Since last publish</div>
                  <div className="health-badges">
                    {info.health.deltas.map((delta) => (
                      <span
                        key={delta.key}
                        className={`health-badge${delta.warn ? ' health-badge-warn' : ''}`}
                      >
                        {delta.label}: {delta.value}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              <ul>
                <li>District: {info.health.districtId}</li>
                <li>Last updated: {info.health.lastUpdated}</li>
                <li>Published: {info.health.publishedAt}</li>
                <li>Segments: {info.health.segmentsCount}</li>
                <li>Sign overrides: {info.health.signOverridesCount}</li>
                <li>
                  Sign overrides matched by segment id:{' '}
                  {info.health.signOverrideMatchedSegmentCount}
                </li>
                <li>
                  Sign overrides matched by spatial fallback:{' '}
                  {info.health.signOverrideSpatialMatchCount}
                </li>
                <li>Overrides applied: {info.health.overridesAppliedCount}</li>
                <li>Unmatched named overrides: {info.health.signOverrideUnmatchedNamedCount}</li>
                <li>Curb marking known: {info.health.curbMarkingKnownRate}</li>
                <li>Restrictions triggered: {info.health.restrictionTriggeredRate}</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="segment-sheet-empty">No dataset info available.</div>
        )}
      </div>
    </div>
  )
}
