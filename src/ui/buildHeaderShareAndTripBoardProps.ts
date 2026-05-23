import type { BuildSharePanelPropsOptions } from './buildSharePanelProps'
import { buildSharePanelProps } from './buildSharePanelProps'
import type { BuildTripBoardPanelPropsOptions } from './buildTripBoardPanelProps'
import { buildTripBoardPanelProps } from './buildTripBoardPanelProps'

export interface BuildHeaderShareAndTripBoardPropsOptions
  extends BuildSharePanelPropsOptions,
    BuildTripBoardPanelPropsOptions {}

export const buildHeaderShareAndTripBoardProps = (
  options: BuildHeaderShareAndTripBoardPropsOptions,
) => ({
  sharePanelProps: buildSharePanelProps(options),
  tripBoardPanelProps: buildTripBoardPanelProps(options),
})
