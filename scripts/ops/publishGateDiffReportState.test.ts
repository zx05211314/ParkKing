import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import * as diffPacksModule from './diffPacks'
import {
  loadGeneratedPublishGateDiffReport,
  loadStoredPublishGateDiffReport,
} from './publishGateDiffReportState'

describe('publishGateDiffReportState', () => {
  it('returns null for unreadable stored diff reports', async () => {
    const datasetDir = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-diff-state-'))
    await fs.writeFile(path.join(datasetDir, 'diff_report.json'), '{bad', 'utf-8')

    await expect(loadStoredPublishGateDiffReport(datasetDir)).resolves.toBeNull()
  })

  it('returns null when no previous published pack exists', async () => {
    const datasetDir = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-diff-state-'))
    const publishedRootDir = await fs.mkdtemp(
      path.join(tmpdir(), 'publish-gate-diff-state-published-'),
    )

    await expect(
      loadGeneratedPublishGateDiffReport({
        districtId: 'xinyi',
        datasetDir,
        publishedRootDir,
      }),
    ).resolves.toBeNull()
  })

  it('logs and returns null when fallback diff generation fails', async () => {
    const datasetDir = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-diff-state-'))
    const publishedRootDir = await fs.mkdtemp(
      path.join(tmpdir(), 'publish-gate-diff-state-published-'),
    )
    const prevDir = path.join(publishedRootDir, 'xinyi')
    await fs.mkdir(prevDir, { recursive: true })
    await fs.writeFile(
      path.join(prevDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )

    const log = vi.fn()
    const diffSpy = vi
      .spyOn(diffPacksModule, 'diffPacks')
      .mockRejectedValue(new Error('boom'))

    await expect(
      loadGeneratedPublishGateDiffReport({
        districtId: 'xinyi',
        datasetDir,
        publishedRootDir,
        log,
      }),
    ).resolves.toBeNull()

    expect(log).toHaveBeenCalledWith('Diff report generation failed:', expect.any(Error))
    diffSpy.mockRestore()
  })
})
