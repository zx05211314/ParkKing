import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createSyncService,
  resolveSyncServiceConfig,
} from './syncService'

describe('resolveSyncServiceConfig', () => {
  it('uses defaults when env vars are absent', () => {
    const config = resolveSyncServiceConfig({}, 'C:/tmp/parkking')

    expect(config).toEqual({
      path: '/api/sync',
      port: 8789,
      storageFile: 'C:\\tmp\\parkking\\.tmp\\sync-service.json',
      defaultScope: 'default',
      maxBodyBytes: 1048576,
      maxIssueReports: 1000,
      corsOrigins: ['*'],
      writeRateLimitWindowMs: 60000,
      writeRateLimitMax: 120,
    })
  })

  it('allows overriding sync service safety limits', () => {
    const config = resolveSyncServiceConfig(
      {
        PARKKING_SYNC_MAX_BODY_BYTES: '2048',
        PARKKING_SYNC_MAX_ISSUE_REPORTS: '25',
        PARKKING_SYNC_CORS_ORIGINS:
          'https://parkking.example, https://ops.parkking.example',
        PARKKING_SYNC_WRITE_RATE_LIMIT_WINDOW_MS: '5000',
        PARKKING_SYNC_WRITE_RATE_LIMIT_MAX: '9',
      },
      'C:/tmp/parkking',
    )

    expect(config.maxBodyBytes).toBe(2048)
    expect(config.maxIssueReports).toBe(25)
    expect(config.corsOrigins).toEqual([
      'https://parkking.example',
      'https://ops.parkking.example',
    ])
    expect(config.writeRateLimitWindowMs).toBe(5000)
    expect(config.writeRateLimitMax).toBe(9)
  })
})

describe('createSyncService', () => {
  it('persists saved plans to disk and reloads them across service instances', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-service-'))
    const storageFile = join(tempRoot, 'sync.json')
    const firstService = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })

    await expect(
      firstService.replaceSavedPlans([
        {
          key: 'plan-1',
          title: 'Taipei 101',
          url: '/?plan=1',
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ]),
    ).resolves.toEqual({
      conflict: false,
      plans: [
        {
          key: 'plan-1',
          title: 'Taipei 101',
          url: '/?plan=1',
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      revision: 1,
    })

    const secondService = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })
    await expect(secondService.getSavedPlans()).resolves.toEqual([
      {
        key: 'plan-1',
        title: 'Taipei 101',
        url: '/?plan=1',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
    ])

    await expect(readFile(storageFile, 'utf8')).resolves.toContain('"savedPlans"')
  })

  it('rejects stale saved-plan revisions and returns the latest server snapshot', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-revision-'))
    const storageFile = join(tempRoot, 'sync.json')
    const service = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })

    await expect(
      service.replaceSavedPlans([
        {
          key: 'plan-1',
          title: 'Taipei 101',
          url: '/?plan=1',
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ]),
    ).resolves.toEqual({
      conflict: false,
      plans: [
        {
          key: 'plan-1',
          title: 'Taipei 101',
          url: '/?plan=1',
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      revision: 1,
    })

    await expect(
      service.replaceSavedPlans(
        [
          {
            key: 'plan-2',
            title: 'Station',
            url: '/?plan=2',
            createdAt: '2026-03-13T01:00:00.000Z',
          },
        ],
        'default',
        0,
      ),
    ).resolves.toEqual({
      conflict: true,
      plans: [
        {
          key: 'plan-1',
          title: 'Taipei 101',
          url: '/?plan=1',
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      revision: 1,
    })
  })

  it('returns scoped sync status metadata and avoids bumping revisions on no-op writes', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-status-'))
    const storageFile = join(tempRoot, 'sync.json')
    const service = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })

    await service.replaceSavedPlans(
      [{ key: 'plan-a', title: 'A', url: '/?a', createdAt: '2026-03-13T00:00:00.000Z' }],
      'alpha',
    )
    await service.replaceSavedPlans(
      [{ key: 'plan-a', title: 'A', url: '/?a', createdAt: '2026-03-13T00:00:00.000Z' }],
      'alpha',
      1,
    )
    await service.appendReport(
      {
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      'alpha',
    )
    await service.appendReport(
      {
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      'alpha',
    )

    await expect(service.getSyncStatus('alpha')).resolves.toEqual(
      expect.objectContaining({
        scope: 'alpha',
        savedPlansRevision: 1,
        reportsRevision: 1,
        savedPlansCount: 1,
        reportsCount: 1,
        savedPlansUpdatedAt: expect.any(String),
        reportsUpdatedAt: expect.any(String),
      }),
    )
  })

  it('appends reports with dedupe and persists them to disk', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-reports-'))
    const storageFile = join(tempRoot, 'sync.json')
    const service = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })

    const report = {
      schemaVersion: 1,
      districtId: 'xinyi',
      segmentId: 'seg-1',
      status: 'ILLEGAL',
      note: 'hydrant',
      createdAt: '2026-03-13T00:00:00.000Z',
    }

    await service.appendReport(report)
    await service.appendReport(report)

    await expect(service.getReports()).resolves.toEqual([report])
    await expect(readFile(storageFile, 'utf8')).resolves.toContain('"reports"')
  })

  it('keeps saved plans isolated by scope', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-scope-'))
    const storageFile = join(tempRoot, 'sync.json')
    const service = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })

    await service.replaceSavedPlans(
      [{ key: 'plan-a', title: 'A', url: '/?a', createdAt: '2026-03-13T00:00:00.000Z' }],
      'alpha',
    )
    await service.replaceSavedPlans(
      [{ key: 'plan-b', title: 'B', url: '/?b', createdAt: '2026-03-13T00:00:00.000Z' }],
      'beta',
    )

    await expect(service.getSavedPlans('alpha')).resolves.toHaveLength(1)
    await expect(service.getSavedPlans('beta')).resolves.toHaveLength(1)
    await expect(service.getSavedPlans('default')).resolves.toHaveLength(0)
  })

  it('returns a combined bootstrap snapshot for the requested scope', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-bootstrap-'))
    const storageFile = join(tempRoot, 'sync.json')
    const service = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })

    await service.replaceSavedPlans(
      [{ key: 'plan-a', title: 'A', url: '/?a', createdAt: '2026-03-13T00:00:00.000Z' }],
      'alpha',
    )
    await service.appendReport(
      {
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      'alpha',
    )

    await expect(service.getSavedPlans('alpha')).resolves.toEqual([
      { key: 'plan-a', title: 'A', url: '/?a', createdAt: '2026-03-13T00:00:00.000Z' },
    ])
    await expect(service.getReports('alpha')).resolves.toEqual([
      {
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        createdAt: '2026-03-13T00:00:00.000Z',
        note: null,
      },
    ])
  })

  it('can scope bootstrap payloads to a single resource', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-sync-bootstrap-scope-'))
    const storageFile = join(tempRoot, 'sync.json')
    const service = createSyncService({
      path: '/api/sync',
      port: 8789,
      storageFile,
      defaultScope: 'default',
    })

    await service.replaceSavedPlans(
      [{ key: 'plan-a', title: 'A', url: '/?a', createdAt: '2026-03-13T00:00:00.000Z' }],
      'alpha',
    )
    await service.appendReport(
      {
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      'alpha',
    )

    await expect(service.getBootstrapState('alpha', ['savedPlans'])).resolves.toEqual({
      plans: [
        {
          key: 'plan-a',
          title: 'A',
          url: '/?a',
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      savedPlansRevision: 1,
    })
  })
})
