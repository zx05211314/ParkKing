import { buildDatasetInfoModel } from './datasetInfo/model'
import type {
  DatasetInfoSheetProps,
} from './appPresentationBuilderTypes'

interface BuildDatasetInfoSheetPropsOptions {
  infoOpen: boolean
  latestInfo: Parameters<typeof buildDatasetInfoModel>[0]['latest']
  datasetMeta: Parameters<typeof buildDatasetInfoModel>[0]['meta']
  manifestInfo: Parameters<typeof buildDatasetInfoModel>[0]['manifest']
  ingestReport: Parameters<typeof buildDatasetInfoModel>[0]['report']
  metricsHistory: Parameters<typeof buildDatasetInfoModel>[0]['metricsHistory']
  dataSourceLabel: Parameters<typeof buildDatasetInfoModel>[0]['dataSource']
  onCloseInfo: () => void
}

export const buildDatasetInfoSheetProps = ({
  infoOpen,
  latestInfo,
  datasetMeta,
  manifestInfo,
  ingestReport,
  metricsHistory,
  dataSourceLabel,
  onCloseInfo,
}: BuildDatasetInfoSheetPropsOptions): DatasetInfoSheetProps => ({
  open: infoOpen,
  info: buildDatasetInfoModel({
    latest: latestInfo,
    meta: datasetMeta,
    manifest: manifestInfo,
    report: ingestReport,
    metricsHistory,
    dataSource: dataSourceLabel,
  }),
  onClose: onCloseInfo,
})
