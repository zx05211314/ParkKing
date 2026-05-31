import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import type { ZoneIndex } from '../domain/zones/zoneIndex'
import type { DatasetMeta } from '../data/segmentBuilder'
import {
  appendReport,
  getLatestReports,
  readReports,
  type ReportStatus,
} from '../feedback/reports'
import { appendIssueReport } from '../feedback/issueReports'
import type { EvaluatedSegment } from './types'

interface UseFeedbackActionsOptions {
  datasetId: string | null
  selectedSegment: EvaluatedSegment | null
  setReportVersion: Dispatch<SetStateAction<number>>
  datasetMeta: DatasetMeta | null
  nowHHMM: string
  includeInferred: boolean
  userLocation: [number, number] | null
  zoneIndex: ZoneIndex | null
}

interface UseFeedbackActionsResult {
  handleReportForSegment: (
    segment: Pick<EvaluatedSegment, 'id'> | null,
    status: ReportStatus,
    note: string,
  ) => void
  handleSegmentReport: (status: ReportStatus, note: string) => void
  handleExportReports: () => void
  handleReportIssue: () => Promise<void>
  issueReportStatus: {
    kind: 'success' | 'warning' | 'error'
    message: string
  } | null
  reportingIssue: boolean
}

export const useFeedbackActions = ({
  datasetId,
  selectedSegment,
  setReportVersion,
  datasetMeta,
  nowHHMM,
  includeInferred,
  userLocation,
  zoneIndex,
}: UseFeedbackActionsOptions): UseFeedbackActionsResult => {
  const [issueReportStatus, setIssueReportStatus] = useState<{
    kind: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [reportingIssue, setReportingIssue] = useState(false)

  const handleReportForSegment = useCallback(
    (
      segment: Pick<EvaluatedSegment, 'id'> | null,
      status: ReportStatus,
      note: string,
    ) => {
      if (!segment || !datasetId) {
        return
      }
      appendReport({
        districtId: datasetId,
        segmentId: segment.id,
        status,
        note,
      })
      setReportVersion((value) => value + 1)
    },
    [datasetId, setReportVersion],
  )

  const handleSegmentReport = useCallback(
    (status: ReportStatus, note: string) => {
      handleReportForSegment(selectedSegment, status, note)
    },
    [handleReportForSegment, selectedSegment],
  )

  const handleExportReports = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }
    const latest = getLatestReports(readReports())
    if (latest.length === 0) {
      return
    }
    const lines = latest.map((entry) => JSON.stringify(entry)).join('\n')
    const blob = new Blob([`${lines}\n`], { type: 'application/jsonl' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '')
    link.href = url
    link.download = `parkking-overrides-${timestamp}.jsonl`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }, [])

  const handleReportIssue = useCallback(async () => {
    setReportingIssue(true)
    setIssueReportStatus(null)

    try {
      const { buildDebugBundle, downloadDebugBundle } = await import(
        './debug/exportDebugBundle'
      )
      const bundle = buildDebugBundle({
        meta: datasetMeta,
        hhmm: nowHHMM,
        includeInferred,
        selectedSegment,
        userLocation,
        zoneIndex,
      })
      const summary = selectedSegment
        ? `Issue report for ${selectedSegment.name}`
        : datasetId
          ? `Dataset issue report for ${datasetId}`
          : 'Issue report'
      const issueResult = await appendIssueReport({
        districtId: datasetId,
        segmentId: selectedSegment?.id ?? null,
        summary,
        bundle,
      })
      downloadDebugBundle(bundle)

      const downloadedMessage = `${issueResult.message} Debug bundle downloaded.`
      if (issueResult.mode === 'remote') {
        setIssueReportStatus({
          kind: 'success',
          message: downloadedMessage,
        })
        return
      }

      if (issueResult.mode === 'fallback-local') {
        setIssueReportStatus({
          kind: 'warning',
          message: issueResult.failureReason
            ? `${downloadedMessage} ${issueResult.failureReason}`
            : downloadedMessage,
        })
        return
      }

      setIssueReportStatus({
        kind: 'warning',
        message: downloadedMessage,
      })
    } catch (error) {
      setIssueReportStatus({
        kind: 'error',
        message:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Issue reporting failed.',
      })
    } finally {
      setReportingIssue(false)
    }
  }, [
    datasetId,
    datasetMeta,
    nowHHMM,
    includeInferred,
    selectedSegment,
    userLocation,
    zoneIndex,
  ])

  return {
    handleReportForSegment,
    handleSegmentReport,
    handleExportReports,
    handleReportIssue,
    issueReportStatus,
    reportingIssue,
  }
}
