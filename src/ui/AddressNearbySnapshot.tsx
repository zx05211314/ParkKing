import type { AddressNearbySnapshotProps } from './addressRecommendationsPanelTypes'

export function AddressNearbySnapshot({
  nearbySnapshot,
}: AddressNearbySnapshotProps) {
  if (!nearbySnapshot) {
    return null
  }

  return (
    <div className="address-snapshot">
      <div className="address-snapshot-chip">
        <span>Park ok</span>
        <strong>{nearbySnapshot.parkCount}</strong>
      </div>
      <div className="address-snapshot-chip">
        <span>Stop ok</span>
        <strong>{nearbySnapshot.stopCount}</strong>
      </div>
      <div className="address-snapshot-chip">
        <span>No stop</span>
        <strong>{nearbySnapshot.noStopCount}</strong>
      </div>
      <div className="address-snapshot-chip">
        <span>With spaces</span>
        <strong>{nearbySnapshot.markedSpaceCount}</strong>
      </div>
      <div className="address-snapshot-chip">
        <span>ETA ready</span>
        <strong>{nearbySnapshot.etaReadyCount}</strong>
      </div>
    </div>
  )
}
