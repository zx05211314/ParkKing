import type { ComponentProps } from 'react'
import { AppHeaderPanels } from './AppHeaderPanels'
import { AppMainWorkspace } from './AppMainWorkspace'
import { AppOverlayHost } from './AppOverlayHost'
import { buildDatasetInfoModel } from './datasetInfo/model'

export type HeaderPanelsProps = ComponentProps<typeof AppHeaderPanels>
export type MainWorkspaceProps = ComponentProps<typeof AppMainWorkspace>
export type OverlayHostProps = ComponentProps<typeof AppOverlayHost>

export interface DatasetInfoSheetProps {
  open: boolean
  info: ReturnType<typeof buildDatasetInfoModel> | null
  onClose: () => void
}
