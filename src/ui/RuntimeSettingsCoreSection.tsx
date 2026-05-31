import type { RuntimeSettingsPanelProps } from './runtimeSettingsPanelTypes'

type RuntimeSettingsCoreSectionProps = Pick<
  RuntimeSettingsPanelProps,
  | 'mode'
  | 'nowHHMM'
  | 'onModeChange'
  | 'useMockLocation'
  | 'onUseMockLocationChange'
  | 'locationLabel'
  | 'radiusMeters'
  | 'onRadiusChange'
  | 'riskMode'
  | 'riskModeLabels'
  | 'onRiskModeChange'
>

export function RuntimeSettingsCoreSection({
  mode,
  nowHHMM,
  onModeChange,
  useMockLocation,
  onUseMockLocationChange,
  locationLabel,
  radiusMeters,
  onRadiusChange,
  riskMode,
  riskModeLabels,
  onRiskModeChange,
}: RuntimeSettingsCoreSectionProps) {
  return (
    <>
      <div className="control-group">
        <div className="control-label">Time mode</div>
        <div className="segmented">
          <button
            type="button"
            className={mode === 'NOW' ? 'active' : ''}
            onClick={() => onModeChange('NOW')}
          >
            Now
          </button>
          <button
            type="button"
            className={mode === 'NIGHT' ? 'active' : ''}
            onClick={() => onModeChange('NIGHT')}
          >
            Night
          </button>
        </div>
        <div className="control-meta">Eval time: {nowHHMM}</div>
      </div>
      <div className="control-group">
        <div className="control-label">Location</div>
        <div className="segmented">
          <button
            type="button"
            className={useMockLocation ? 'active' : ''}
            onClick={() => onUseMockLocationChange(true)}
          >
            Mock
          </button>
          <button
            type="button"
            className={!useMockLocation ? 'active' : ''}
            onClick={() => onUseMockLocationChange(false)}
          >
            Device
          </button>
        </div>
        <div className="control-meta">Source: {locationLabel}</div>
      </div>
      <div className="control-group">
        <div className="control-label">Radius (m)</div>
        <div className="control-input">
          <input
            type="number"
            min={100}
            max={3000}
            step={50}
            value={radiusMeters}
            onChange={(event) => onRadiusChange(event.target.value)}
          />
        </div>
        <div className="control-meta">Cutoff: {radiusMeters} m</div>
      </div>
      <div className="control-group">
        <div className="control-label">Risk mode</div>
        <div className="segmented">
          <button
            type="button"
            className={riskMode === 'CONSERVATIVE' ? 'active' : ''}
            onClick={() => onRiskModeChange('CONSERVATIVE')}
          >
            Conservative
          </button>
          <button
            type="button"
            className={riskMode === 'NEUTRAL' ? 'active' : ''}
            onClick={() => onRiskModeChange('NEUTRAL')}
          >
            Neutral
          </button>
          <button
            type="button"
            className={riskMode === 'AGGRESSIVE' ? 'active' : ''}
            onClick={() => onRiskModeChange('AGGRESSIVE')}
          >
            Aggressive
          </button>
        </div>
        <div className="control-meta">Bias: {riskModeLabels[riskMode]}</div>
      </div>
    </>
  )
}
