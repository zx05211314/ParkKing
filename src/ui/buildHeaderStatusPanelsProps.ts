import { buildDatasetStatusPanelProps } from './buildDatasetStatusPanelProps'
import type { BuildHeaderStatusPanelsPropsOptions } from './buildHeaderStatusPanelsTypes'
import { buildRuntimeSettingsPanelProps } from './buildRuntimeSettingsPanelProps'

export type { BuildHeaderStatusPanelsPropsOptions } from './buildHeaderStatusPanelsTypes'

export const buildHeaderStatusPanelsProps = (
  options: BuildHeaderStatusPanelsPropsOptions,
) => ({
  runtimeSettingsPanelProps: buildRuntimeSettingsPanelProps(options),
  datasetStatusPanelProps: buildDatasetStatusPanelProps(options),
})
