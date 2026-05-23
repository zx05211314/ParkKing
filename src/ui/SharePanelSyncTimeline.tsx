import type { SharePanelTimelineEntry } from './sharePanelTypes'

interface SharePanelSyncTimelineProps {
  timelineEntries: SharePanelTimelineEntry[]
}

export const SharePanelSyncTimeline = ({
  timelineEntries,
}: SharePanelSyncTimelineProps) => {
  if (timelineEntries.length === 0) {
    return null
  }

  return (
    <div className="share-status-timeline">
      {timelineEntries.map((entry) => (
        <div key={entry.id} className="share-status-timeline-row">
          <div
            className={['share-status-timeline-label', entry.statusClassName]
              .filter(Boolean)
              .join(' ')}
          >
            {entry.label}
          </div>
          <div className="share-status-timeline-value">{entry.value}</div>
        </div>
      ))}
    </div>
  )
}
