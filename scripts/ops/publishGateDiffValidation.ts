import { loadGeneratedPublishGateDiffReport, loadStoredPublishGateDiffReport } from './publishGateDiffReportState'
import { buildPublishGateDiffReportWarnings } from './publishGateDiffWarningState'

export const buildPublishGateDiffWarnings = async (
  districtId: string,
  datasetDir: string,
  publishedRootDir?: string | null,
  strictDiff?: boolean,
) => {
  const storedReport = await loadStoredPublishGateDiffReport(datasetDir)
  if (storedReport) {
    return buildPublishGateDiffReportWarnings({
      districtId,
      diffReport: storedReport,
      strictDiff,
    })
  }

  const generatedReport = await loadGeneratedPublishGateDiffReport({
    districtId,
    datasetDir,
    publishedRootDir,
  })
  return generatedReport
    ? buildPublishGateDiffReportWarnings({
        districtId,
        diffReport: generatedReport,
        strictDiff,
      })
    : []
}
