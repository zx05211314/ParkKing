import type {
  AddressRecommendationsProps,
  BuildAddressRecommendationsPropsOptions,
} from './buildAddressRecommendationsPropsTypes'
import type {
  AddressSearchPanelProps,
  BuildAddressSearchPanelPropsOptions,
} from './buildAddressSearchPanelPropsTypes'
import type {
  BuildPrimaryControlsPropsOptions,
  PrimaryControlsProps,
} from './buildPrimaryControlsPropsTypes'

export type {
  AddressRecommendationsProps,
  AddressSearchPanelProps,
  PrimaryControlsProps,
}

export interface BuildHeaderSearchPanelsPropsOptions
  extends BuildPrimaryControlsPropsOptions,
    BuildAddressSearchPanelPropsOptions,
    BuildAddressRecommendationsPropsOptions {}
