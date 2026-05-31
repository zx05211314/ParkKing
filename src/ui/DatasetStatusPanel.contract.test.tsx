import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DatasetStatusPanel } from './DatasetStatusPanel'

describe('DatasetStatusPanel contract', () => {
  it('renders issue submission status and reporting state', () => {
    const html = renderToStaticMarkup(
      <DatasetStatusPanel
        districtName="Xinyi"
        schemaVersion="1"
        segmentsCount={10}
        inferredCount={2}
        overrideCount={1}
        signOverrideMatchedSegmentCount={1}
        signOverrideSpatialMatchCount={0}
        signOverrideUnmatchedNamedCount={2}
        zonesCount={12}
        intersectionCount={4}
        crosswalkCount={3}
        parkingSpaceCount={20}
        modeLabel="Day"
        builtAtLabel="Apr 2"
        evaluationStatus="ready"
        clipCacheSummary="hits 1 | misses 2 | size 3"
        datasetStatus="ready"
        issueReportSyncLabel="Upload-only"
        issueReportSyncNote="New issue reports upload from this device when sync is available. Shared scopes do not pull them back down."
        issueReportDebugBundleNote="Issue reports include dataset metadata, current mode/time, selected segment geometry, parking-rule reasons, ranking details, and nearby-zone counts."
        issueReportStatus={{
          kind: 'success',
          message: 'Issue submitted to ParkKing Sync. Debug bundle downloaded.',
        }}
        reportingIssue={true}
        onReportIssue={() => {}}
        onExportReports={() => {}}
        onOpenInfo={() => {}}
      />,
    )

    expect(html).toContain('District: Xinyi')
    expect(html).toContain('Reporting issue...')
    expect(html).toContain('Issue report sync: Upload-only')
    expect(html).toContain('Named override matches: 1 direct | 0 spatial fallback')
    expect(html).toContain('Named overrides unmatched: 2')
    expect(html).toContain(
      'New issue reports upload from this device when sync is available. Shared scopes do not pull them back down.',
    )
    expect(html).toContain(
      'Issue reports include dataset metadata, current mode/time, selected segment geometry, parking-rule reasons, ranking details, and nearby-zone counts.',
    )
    expect(html).toContain('Issue submitted to ParkKing Sync. Debug bundle downloaded.')
    expect(html).toContain('control-meta status-success')
    expect(html).toContain('disabled=""')
  })
})
