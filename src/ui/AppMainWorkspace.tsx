import {
  Suspense,
  type ComponentProps,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import type { MapViewProps } from '../map/MapView'
import { MapErrorBoundary } from './MapErrorBoundary'
import { SegmentList } from './SegmentList'

interface AppMainWorkspaceProps {
  activeView: 'LIST' | 'MAP'
  mapViewComponent: LazyExoticComponent<ComponentType<MapViewProps>>
  mapRetryKey: number
  onMapRetry: () => void
  mapViewProps: MapViewProps
  hasPinnedAddress: boolean
  parkingSpaceCount: number
  selectedParkingSpaceMarkerCount: number
  recommendedParkingTargetMarkerCount: number
  hasRouteGeometry: boolean
  selectedRouteProfile: 'walking' | 'driving'
  selectedRouteProfileLabel: string
  hasArrivalTarget: boolean
  selectedArrivalKind: 'SEGMENT' | 'PARKING_SPACE' | null
  listProps: ComponentProps<typeof SegmentList>
}

const MapSkeleton = () => (
  <div className="map-skeleton">
    <div className="map-skeleton-title">Loading map?</div>
    <div className="map-skeleton-grid">
      <div className="map-skeleton-block" />
      <div className="map-skeleton-block" />
      <div className="map-skeleton-block" />
    </div>
  </div>
)

export const AppMainWorkspace = ({
  activeView,
  mapViewComponent: MapViewComponent,
  mapRetryKey,
  onMapRetry,
  mapViewProps,
  hasPinnedAddress,
  parkingSpaceCount,
  selectedParkingSpaceMarkerCount,
  recommendedParkingTargetMarkerCount,
  hasRouteGeometry,
  selectedRouteProfile,
  selectedRouteProfileLabel,
  hasArrivalTarget,
  selectedArrivalKind,
  listProps,
}: AppMainWorkspaceProps) => (
  <main className={activeView === 'LIST' ? 'app-main app-main-list' : 'app-main'}>
    {activeView === 'MAP' ? (
      <>
        <section className="map-panel">
          <MapErrorBoundary onRetry={onMapRetry} resetKey={mapRetryKey}>
            <Suspense fallback={<MapSkeleton />}>
              <MapViewComponent {...mapViewProps} />
            </Suspense>
          </MapErrorBoundary>
          <div className="map-legend">
            <div>
              <span className="legend-swatch green" /> Green: park ok
            </div>
            <div>
              <span className="legend-swatch yellow" /> Yellow: caution
            </div>
            <div>
              <span className="legend-swatch red" /> Red: no stop
            </div>
            {hasPinnedAddress ? (
              <div>
                <span className="legend-swatch recommended" /> Gold: top nearby
              </div>
            ) : null}
            {parkingSpaceCount > 0 ? (
              <div>
                <span className="legend-swatch parking-space" /> Marked spaces
              </div>
            ) : null}
            {selectedParkingSpaceMarkerCount > 0 ? (
              <div>
                <span className="legend-swatch parking-space-option" /> Numbered targets
              </div>
            ) : null}
            {recommendedParkingTargetMarkerCount > 0 ? (
              <div>
                <span className="legend-swatch recommended-target" /> Ranked exact targets
              </div>
            ) : null}
            {hasRouteGeometry ? (
              <div>
                <span
                  className={
                    selectedRouteProfile === 'walking'
                      ? 'legend-swatch route-walk'
                      : 'legend-swatch route-drive'
                  }
                />{' '}
                {selectedRouteProfileLabel}
              </div>
            ) : null}
            {hasArrivalTarget ? (
              <div>
                <span className="legend-swatch arrival" />{' '}
                {selectedArrivalKind === 'PARKING_SPACE'
                  ? 'Marked space target'
                  : 'Arrival target'}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="list-panel">
          <SegmentList {...listProps} />
        </aside>
      </>
    ) : (
      <section className="list-panel list-panel-full">
        <SegmentList {...listProps} />
      </section>
    )}
  </main>
)
