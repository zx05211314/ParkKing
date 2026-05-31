import type { ReactNode } from 'react'

interface RuntimeSettingsOverlayToggleGroupProps {
  label: string
  enabled: boolean
  onChange: (value: boolean) => void
  children?: ReactNode
}

export function RuntimeSettingsOverlayToggleGroup({
  label,
  enabled,
  onChange,
  children,
}: RuntimeSettingsOverlayToggleGroupProps) {
  return (
    <div className="control-group">
      <div className="control-label">{label}</div>
      <div className="segmented">
        <button
          type="button"
          className={enabled ? 'active' : ''}
          onClick={() => onChange(true)}
        >
          Show
        </button>
        <button
          type="button"
          className={!enabled ? 'active' : ''}
          onClick={() => onChange(false)}
        >
          Hide
        </button>
      </div>
      <div className="control-meta">Overlay: {enabled ? 'On' : 'Off'}</div>
      {children}
    </div>
  )
}
