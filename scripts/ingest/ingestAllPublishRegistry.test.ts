import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildGateResultLabel,
  writeIngestAllRegistry,
} from './ingestAllPublishRegistry'
import type { RegistryEntry } from '../ops/registryUtils'
import type { IngestDistrictSummary } from './ingestAllTypes'

const createSummary = (
  overrides: Partial<IngestDistrictSummary> = {},
): IngestDistrictSummary =>
  ({
    districtId: 'xinyi',
    label: 'xinyi.json',
    datasetHash: 'hash-1',
    counts: null,
    bbox: null,
    dayEval: null,
    nightEval: null,
    intersectionsReport: null,
    riskTagCounts: null,
    districtName: 'Xinyi',
    schemaVersion: 3,
    generatedAt: '2026-03-21T00:00:00.000Z',
    warnings: [],
    baselineStatus: 'missing',
    baselineCandidate: null,
    thresholds: {
      counts: {
        segments: 1,
        intersections: 1,
        inferredCandidates: 1,
        signOverrides: 1,
      },
      tierDistributionMaxDeltaPct: 1,
      perfRegressionMaxDeltaPct: 1,
      maxReasonCodeDeltaPct: 1,
      maxNewReasonCodePct: 1,
    },
    retention: {
      maxBackupsPerDistrict: 5,
      maxBackupAgeDays: 30,
    },
    config: {} as never,
    ...overrides,
  }) as IngestDistrictSummary

const createRegistryEntry = (
  overrides: Partial<RegistryEntry> = {},
): RegistryEntry => {
  const districtId = overrides.districtId ?? 'xinyi'
  const districtName = overrides.districtName ?? 'Xinyi'
  const datasetHash = overrides.datasetHash ?? overrides.latest?.datasetHash ?? 'hash-1'
  const publishedAt =
    overrides.publishedAt ?? overrides.latest?.publishedAt ?? '2026-03-21T00:00:00.000Z'
  return {
    districtId,
    districtName,
    schemaVersion: overrides.schemaVersion ?? 3,
    datasetHash,
    publishedAt,
    generatedAt: overrides.generatedAt ?? '2026-03-21T00:00:00.000Z',
    totalBytes: overrides.totalBytes ?? 100,
    fileCount: overrides.fileCount ?? 1,
    metaSha256: overrides.metaSha256 ?? `${districtId}-meta-sha`,
    packSha256: overrides.packSha256 ?? `${districtId}-pack-sha`,
    latest: overrides.latest ?? {
      datasetHash,
      publishedAt,
    },
  }
}

describe('ingestAllPublishRegistry', () => {
  it('builds publish gate result labels from warning state and overrides', () => {
    expect(
      buildGateResultLabel(createSummary(), {
        allowWarn: false,
        allowFail: false,
      }),
    ).toBe('PASS')

    expect(
      buildGateResultLabel(
        createSummary({
          warnings: [{ severity: 'WARN', code: 'COUNT_DELTA', message: 'warn' }],
        }),
        { allowWarn: false, allowFail: false },
      ),
    ).toBe('WARN')

    expect(
      buildGateResultLabel(
        createSummary({
          warnings: [{ severity: 'FAIL', code: 'BASELINE_MISSING', message: 'fail' }],
        }),
        { allowWarn: true, allowFail: false },
      ),
    ).toBe('OVERRIDE')
  })

  it('writes registry entries for published summaries only', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-registry-'))
    const messages: string[] = []
    const xinyiEntry = createRegistryEntry()
    const summaries = [
      createSummary({
        registryEntry: xinyiEntry,
      }),
      createSummary({ districtId: 'daan', registryEntry: undefined }),
    ]

    await writeIngestAllRegistry({
      summaries,
      generatedAt: '2026-03-21T01:00:00.000Z',
      cwd,
      logger: (message) => messages.push(message),
    })

    const registryPath = path.resolve(cwd, 'public/data/generated/registry.json')
    const raw = await fs.readFile(registryPath, 'utf-8')
    expect(JSON.parse(raw)).toEqual({
      generatedAt: '2026-03-21T01:00:00.000Z',
      districts: [xinyiEntry],
    })
    expect(messages).toContain(`Wrote registry to ${registryPath}`)
  })

  it('preserves existing published registry entries outside the current publish run', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-registry-preserve-'))
    const registryPath = path.resolve(cwd, 'public/data/generated/registry.json')
    const preservedXinyiEntry = createRegistryEntry({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      datasetHash: 'xinyi-hash',
      publishedAt: '2026-03-20T00:00:00.000Z',
      generatedAt: '2026-03-20T00:00:00.000Z',
      latest: {
        datasetHash: 'xinyi-hash',
        publishedAt: '2026-03-20T00:00:00.000Z',
      },
    })
    const daanEntry = createRegistryEntry({
      districtId: 'daan',
      districtName: 'Daan',
      datasetHash: 'daan-hash',
      publishedAt: '2026-03-21T00:00:00.000Z',
      latest: {
        datasetHash: 'daan-hash',
        publishedAt: '2026-03-21T00:00:00.000Z',
      },
    })
    await fs.mkdir(path.dirname(registryPath), { recursive: true })
    await fs.writeFile(
      registryPath,
      JSON.stringify(
        {
          generatedAt: '2026-03-20T00:00:00.000Z',
          districts: [preservedXinyiEntry],
        },
        null,
        2,
      ),
      'utf-8',
    )

    await writeIngestAllRegistry({
      summaries: [
        createSummary({
          districtId: 'daan',
          registryEntry: daanEntry,
        }),
      ],
      generatedAt: '2026-03-21T01:00:00.000Z',
      cwd,
      logger: () => {},
    })

    const raw = await fs.readFile(registryPath, 'utf-8')
    expect(JSON.parse(raw)).toEqual({
      generatedAt: '2026-03-21T01:00:00.000Z',
      districts: [daanEntry, preservedXinyiEntry],
    })
  })
})
