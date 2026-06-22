import type { ComponentProps } from 'react'
import { AddressRecommendationsPanel } from './AddressRecommendationsPanel'
import { AddressSearchPanel } from './AddressSearchPanel'
import { DatasetStatusPanel } from './DatasetStatusPanel'
import { PrimaryControlsPanel } from './PrimaryControlsPanel'
import { RuntimeSettingsPanel } from './RuntimeSettingsPanel'
import { SharePanel } from './SharePanel'
import { TripBoardPanel } from './TripBoardPanel'

interface AppHeaderPanelsProps {
  packError: string | null
  datasetId: string | null
  primaryControlsProps: ComponentProps<typeof PrimaryControlsPanel>
  addressSearchPanelProps: Omit<ComponentProps<typeof AddressSearchPanel>, 'children'>
  addressRecommendationsProps: ComponentProps<typeof AddressRecommendationsPanel>
  sharePanelProps: ComponentProps<typeof SharePanel>
  tripBoardPanelProps: ComponentProps<typeof TripBoardPanel>
  runtimeSettingsPanelProps: ComponentProps<typeof RuntimeSettingsPanel>
  datasetStatusPanelProps: ComponentProps<typeof DatasetStatusPanel>
}

export const AppHeaderPanels = ({
  packError,
  datasetId,
  primaryControlsProps,
  addressSearchPanelProps,
  addressRecommendationsProps,
  sharePanelProps,
  tripBoardPanelProps,
  runtimeSettingsPanelProps,
  datasetStatusPanelProps,
}: AppHeaderPanelsProps) => (
  <>
    {packError ? (
      <div className="pack-error">
        <div className="pack-error-card">
          <div className="pack-error-title">Dataset pack error</div>
          <div className="pack-error-body">
            {packError.split('\n').map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
          <div className="pack-error-hint">
            Verify the dataset folder or rerun ingest for {datasetId}.
          </div>
        </div>
      </div>
    ) : null}
    <header className="app-header">
      <div className="app-title-block">
        <div className="app-title">Park King</div>
        <div className="app-subtitle">Reviewed curb parking intelligence</div>
      </div>
      <div className="header-controls">
        <PrimaryControlsPanel {...primaryControlsProps} />
        <AddressSearchPanel {...addressSearchPanelProps}>
          <AddressRecommendationsPanel {...addressRecommendationsProps} />
        </AddressSearchPanel>
        <SharePanel {...sharePanelProps} />
        <TripBoardPanel {...tripBoardPanelProps} />
        <RuntimeSettingsPanel {...runtimeSettingsPanelProps} />
        <DatasetStatusPanel {...datasetStatusPanelProps} />
      </div>
    </header>
  </>
)
