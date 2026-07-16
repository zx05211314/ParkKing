import { useState } from 'react'
import type { PaidCurbReferenceState } from './usePaidCurbReferenceState'
import {
  findPaidCurbReferenceMatches,
  suggestPaidCurbRoadQuery,
} from './paidCurbReferenceSearch'

interface PaidCurbReferencePanelProps {
  state: PaidCurbReferenceState
  addressLabel: string | null
}

export function PaidCurbReferencePanel({
  state,
  addressLabel,
}: PaidCurbReferencePanelProps) {
  const suggestedQuery = suggestPaidCurbRoadQuery(addressLabel)
  const [query, setQuery] = useState(suggestedQuery)

  if (state.status === 'idle') {
    return null
  }
  if (state.status === 'loading') {
    return (
      <div className="paid-curb-reference-status">
        Loading official paid-curb source text...
      </div>
    )
  }
  if (state.status === 'error' || !state.district) {
    return (
      <div className="paid-curb-reference-status reference-error">
        Official source text unavailable: {state.error ?? 'unknown error'}
      </div>
    )
  }

  const matches = findPaidCurbReferenceMatches(state.district, query)
  return (
    <section className="paid-curb-reference-panel" aria-label="Paid curb source text">
      <div className="paid-curb-reference-heading">
        <div>
          <strong>Official paid-curb source text</strong>
          <span>
            {state.district.recordCount} district record
            {state.district.recordCount === 1 ? '' : 's'}
          </span>
        </div>
        <span className="paid-curb-reference-badge">TEXT ONLY</span>
      </div>
      <div className="paid-curb-reference-warning">
        These are road-description text matches, not spatial matches. They do not
        show that the pinned curb is legal or paid parking.
      </div>
      <label className="paid-curb-reference-search">
        <span>Filter by Chinese road name</span>
        <input
          type="search"
          value={query}
          placeholder="Example: 縣府路"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {query.trim() ? (
        <div className="paid-curb-reference-results">
          <div className="paid-curb-reference-result-count">
            {matches.total} source-text match{matches.total === 1 ? '' : 'es'}
          </div>
          {matches.records.map((record) => (
            <article
              className="paid-curb-reference-row"
              key={record.parkingSegmentId}
            >
              <div className="paid-curb-reference-row-title">
                {record.description}
              </div>
              <div className="paid-curb-reference-row-meta">
                Source ID {record.parkingSegmentId}
                {record.hasChargingPoint ? ' | charging point reported' : ''}
              </div>
              <div className="paid-curb-reference-fare">
                {record.fareDescription ?? 'No fare text in the source record.'}
              </div>
            </article>
          ))}
          {matches.total === 0 ? (
            <div className="paid-curb-reference-empty">
              No district source description contains this road name. This is not
              evidence that paid parking is unavailable.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="paid-curb-reference-empty">
          Enter a Chinese road name to search the district source text.
        </div>
      )}
      {state.sourceUrl ? (
        <a
          className="paid-curb-reference-source-link"
          href={state.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open raw reference pack
        </a>
      ) : null}
    </section>
  )
}
