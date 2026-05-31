import type { HeaderPanelsProps } from './appPresentationBuilderTypes'
import type { SharePanelSyncStatus } from './sharePanelTypes'
import { buildSharePanelSyncModel } from './sharePanelModel'

type SharePanelProps = HeaderPanelsProps['sharePanelProps']

export interface BuildSharePanelPropsOptions
  extends Omit<SharePanelProps, 'syncViewModel'> {
  syncStatus: SharePanelSyncStatus
}

export const buildSharePanelProps = ({
  syncStatus,
  ...options
}: BuildSharePanelPropsOptions): SharePanelProps => ({
  ...options,
  syncViewModel: buildSharePanelSyncModel(syncStatus),
})
