import type { EvaluatedSegment } from './types'

interface SegmentSheetTimeWindowsSectionProps {
  title: string
  windows: EvaluatedSegment['timeWindows']
}

export function SegmentSheetTimeWindowsSection({
  title,
  windows,
}: SegmentSheetTimeWindowsSectionProps) {
  return (
    <div className="segment-sheet-section">
      <div className="segment-sheet-label">{title}</div>
      {windows.length === 0 ? (
        <div className="segment-sheet-value">-</div>
      ) : (
        <div className="time-windows">
          {windows.map((window) => (
            <div key={window.label} className="time-window">
              <span>{window.label}</span>
              <span>
                {window.startHHMM}-{window.endHHMM}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
