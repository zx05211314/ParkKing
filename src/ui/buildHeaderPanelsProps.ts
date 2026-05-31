import { buildHeaderSearchPanelsProps, type BuildHeaderSearchPanelsPropsOptions } from './buildHeaderSearchPanelsProps'
import {
  buildHeaderShareAndTripBoardProps,
  type BuildHeaderShareAndTripBoardPropsOptions,
} from './buildHeaderShareAndTripBoardProps'
import {
  buildHeaderStatusPanelsProps,
  type BuildHeaderStatusPanelsPropsOptions,
} from './buildHeaderStatusPanelsProps'
import type { HeaderPanelsProps } from './appPresentationBuilderTypes'

interface BuildHeaderPanelsPropsOptions
  extends BuildHeaderSearchPanelsPropsOptions,
    BuildHeaderShareAndTripBoardPropsOptions,
    BuildHeaderStatusPanelsPropsOptions {
  packError: HeaderPanelsProps['packError']
  datasetId: HeaderPanelsProps['datasetId']
}

export const buildHeaderPanelsProps = ({
  packError,
  datasetId,
  ...options
}: BuildHeaderPanelsPropsOptions): HeaderPanelsProps => ({
  packError,
  datasetId,
  ...buildHeaderSearchPanelsProps({
    ...options,
    datasetId,
  }),
  ...buildHeaderShareAndTripBoardProps(options),
  ...buildHeaderStatusPanelsProps(options),
})
