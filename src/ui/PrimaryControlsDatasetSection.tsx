import type { PrimaryControlsPanelProps } from './primaryControlsPanelTypes'

type PrimaryControlsDatasetSectionProps = Pick<
  PrimaryControlsPanelProps,
  'datasetId' | 'datasetOptions' | 'onDatasetIdChange'
>

export function PrimaryControlsDatasetSection({
  datasetId,
  datasetOptions,
  onDatasetIdChange,
}: PrimaryControlsDatasetSectionProps) {
  return (
    <div className="control-group">
      <div className="control-label">Dataset</div>
      <div className="control-input">
        <input
          list="dataset-options"
          value={datasetId ?? ''}
          onChange={(event) => {
            const next = event.target.value.trim()
            onDatasetIdChange(next.length > 0 ? next : null)
          }}
        />
        <datalist id="dataset-options">
          {datasetOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </datalist>
      </div>
      <div className="control-meta">Active: {datasetId ?? 'Auto'}</div>
    </div>
  )
}
