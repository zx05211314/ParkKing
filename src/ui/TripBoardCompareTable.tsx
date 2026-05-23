import type { SavedPlanComparisonRow } from './savedPlanTypes'

interface TripBoardCompareTableProps {
  savedPlanComparisonRows: SavedPlanComparisonRow[]
}

export const TripBoardCompareTable = ({
  savedPlanComparisonRows,
}: TripBoardCompareTableProps) => {
  if (savedPlanComparisonRows.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-compare-table">
      {savedPlanComparisonRows.map((row) => (
        <div
          key={row.label}
          className={row.same ? 'saved-plan-compare-row' : 'saved-plan-compare-row different'}
        >
          <div className="saved-plan-compare-label">{row.label}</div>
          <div className="saved-plan-compare-value">{row.left}</div>
          <div className="saved-plan-compare-value">{row.right}</div>
        </div>
      ))}
    </div>
  )
}
