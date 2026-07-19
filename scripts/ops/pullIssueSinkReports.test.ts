import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  pullIssueSinkReports,
  type PullIssueSinkReportsOptions,
} from './pullIssueSinkReports'

const createOptions = (
  overrides: Partial<PullIssueSinkReportsOptions> = {},
): PullIssueSinkReportsOptions => ({
  adminUrl: 'https://sink.example/issues',
  adminToken: 'admin-token',
  outputPath: '.tmp/sync-service.json',
  defaultScope: 'default',
  pageLimit: 2,
  maxPages: 10,
  requireConfig: true,
  ...overrides,
})

const createResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

describe('pullIssueSinkReports', () => {
  it('paginates durable exports into the existing sync store schema', async () => {
    const root = await mkdtemp(join(tmpdir(), 'parkking-pull-issue-sink-'))
    const outputPath = join(root, 'sync-service.json')
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createResponse({
          issues: [
            {
              receiptId: 3,
              scope: 'alpha',
              issueId: 'issue-c',
              receivedAt: '2026-07-19T13:03:00.000Z',
              envelope: {
                issue: { issueId: 'issue-c', summary: 'C' },
              },
            },
            {
              receiptId: 2,
              scope: 'beta',
              issueId: 'issue-b',
              receivedAt: '2026-07-19T13:02:00.000Z',
              envelope: {
                issue: { issueId: 'issue-b', summary: 'B' },
              },
            },
          ],
          nextCursor: '2',
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          issues: [
            {
              receiptId: 1,
              scope: 'alpha',
              issueId: 'issue-a',
              receivedAt: '2026-07-19T13:01:00.000Z',
              envelope: {
                issue: { issueId: 'issue-a', summary: 'A' },
              },
            },
          ],
          nextCursor: null,
        }),
      )

    await expect(
      pullIssueSinkReports(
        createOptions({ outputPath }),
        fetchImpl,
      ),
    ).resolves.toEqual({
      status: 'pulled',
      outputPath,
      pages: 2,
      issueCount: 3,
      scopes: ['alpha', 'beta'],
      message: 'Pulled 3 durable issue reports.',
    })

    expect(fetchImpl.mock.calls[1]?.[0]).toContain('before=2')
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer admin-token',
    })
    const store = JSON.parse(await readFile(outputPath, 'utf8'))
    expect(store.buckets.alpha.issueReports).toEqual([
      { issueId: 'issue-a', summary: 'A' },
      { issueId: 'issue-c', summary: 'C' },
    ])
    expect(store.buckets.alpha.issueReportsRevision).toBe(2)
    expect(store.buckets.beta.issueReports).toEqual([
      { issueId: 'issue-b', summary: 'B' },
    ])
  })

  it('skips cleanly when optional workflow secrets are absent', async () => {
    await expect(
      pullIssueSinkReports(
        createOptions({
          adminUrl: null,
          adminToken: null,
          requireConfig: false,
        }),
      ),
    ).resolves.toMatchObject({
      status: 'skipped',
      pages: 0,
      issueCount: 0,
    })
  })

  it('fails when a page repeats its cursor', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        createResponse({
          issues: [],
          nextCursor: '5',
        }),
      )

    await expect(
      pullIssueSinkReports(createOptions(), fetchImpl),
    ).rejects.toThrow('Issue sink export repeated cursor 5.')
  })
})
