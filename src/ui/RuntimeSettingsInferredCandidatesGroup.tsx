interface RuntimeSettingsInferredCandidatesGroupProps {
  showInferredCandidates: boolean
  onShowInferredCandidatesChange: (value: boolean) => void
  includeInferred: boolean
  onIncludeInferredChange: (value: boolean) => void
}

export function RuntimeSettingsInferredCandidatesGroup({
  showInferredCandidates,
  onShowInferredCandidatesChange,
  includeInferred,
  onIncludeInferredChange,
}: RuntimeSettingsInferredCandidatesGroupProps) {
  return (
    <div className="control-group">
      <div className="control-label">Inferred candidates</div>
      <div className="segmented">
        <button
          type="button"
          className={showInferredCandidates ? 'active' : ''}
          onClick={() => onShowInferredCandidatesChange(true)}
        >
          Show
        </button>
        <button
          type="button"
          className={!showInferredCandidates ? 'active' : ''}
          onClick={() => onShowInferredCandidatesChange(false)}
        >
          Hide
        </button>
      </div>
      <div className="control-meta">
        Overlay: {showInferredCandidates ? 'On' : 'Off'}
      </div>
      <div className="segmented" style={{ marginTop: '8px' }}>
        <button
          type="button"
          className={includeInferred ? 'active' : ''}
          onClick={() => onIncludeInferredChange(true)}
        >
          Include
        </button>
        <button
          type="button"
          className={!includeInferred ? 'active' : ''}
          onClick={() => onIncludeInferredChange(false)}
        >
          Exclude
        </button>
      </div>
      <div className="control-meta">
        List: {includeInferred ? 'Includes inferred' : 'Official only'}
      </div>
    </div>
  )
}
