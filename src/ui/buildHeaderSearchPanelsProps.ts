import {
  buildAddressRecommendationsProps,
} from './buildAddressRecommendationsProps'
import { buildAddressSearchPanelProps } from './buildAddressSearchPanelProps'
import type { BuildHeaderSearchPanelsPropsOptions } from './buildHeaderSearchPanelsTypes'
import { buildPrimaryControlsProps } from './buildPrimaryControlsProps'

export type { BuildHeaderSearchPanelsPropsOptions } from './buildHeaderSearchPanelsTypes'

export const buildHeaderSearchPanelsProps = (
  options: BuildHeaderSearchPanelsPropsOptions,
) => ({
  primaryControlsProps: buildPrimaryControlsProps(options),
  addressSearchPanelProps: buildAddressSearchPanelProps(options),
  addressRecommendationsProps: buildAddressRecommendationsProps(options),
})
