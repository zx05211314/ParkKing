import type { PaidCurbReferencePointSelection } from './paidCurbReferenceSelection'

export interface PaidCurbReferenceMapDetailProps {
  selection: PaidCurbReferencePointSelection
  onClose: () => void
}

const formatCoordinates = ([longitude, latitude]: [number, number]) =>
  `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`

export function PaidCurbReferenceMapDetail({
  selection,
  onClose,
}: PaidCurbReferenceMapDetailProps) {
  return (
    <aside
      className="map-paid-curb-detail"
      aria-label="Selected paid-curb reference point"
      aria-live="polite"
    >
      <div className="map-paid-curb-detail-heading">
        <div>
          <span>Official source reference</span>
          <strong>{selection.description}</strong>
        </div>
        <button
          type="button"
          className="map-paid-curb-detail-close"
          onClick={onClose}
          aria-label="Close paid-curb reference details"
        >
          Close
        </button>
      </div>
      <p className="map-paid-curb-detail-warning">
        Reference point only. This is not exact curb geometry, a parking-space
        marker, or a parking legality answer.
      </p>
      <dl className="map-paid-curb-detail-fields">
        <div>
          <dt>Segment ID</dt>
          <dd>{selection.parkingSegmentId}</dd>
        </div>
        <div>
          <dt>Fare source text</dt>
          <dd>{selection.fareDescription ?? 'Not listed in source'}</dd>
        </div>
        <div>
          <dt>Charging point</dt>
          <dd>
            {selection.hasChargingPoint
              ? 'Listed in source'
              : 'Not listed in source'}
          </dd>
        </div>
        <div>
          <dt>Representative coordinates</dt>
          <dd>{formatCoordinates(selection.coordinates)}</dd>
        </div>
      </dl>
    </aside>
  )
}
