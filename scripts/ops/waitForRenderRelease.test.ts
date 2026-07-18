import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import type { RenderDeploymentVerifyResult } from './renderDeploymentVerify'
import {
  parseWaitForRenderReleaseArgs,
  renderWaitForRenderRelease,
  waitForRenderRelease,
  writeWaitForRenderReleaseOutputs,
  type WaitForRenderReleaseOptions,
} from './waitForRenderRelease'

const options: WaitForRenderReleaseOptions = {
  appUrl: 'https://parkking.onrender.com',
  handoffJsonPath: '.tmp/upstream/.tmp/render-deployment-handoff.json',
  timeoutMs: 100,
  intervalMs: 10,
  requestTimeoutMs: 20,
  outPath: null,
  jsonOutPath: null,
}

const verifyResult = (
  pass: boolean,
  actualDatasetHash: string,
): RenderDeploymentVerifyResult => ({
  pass,
  appUrl: options.appUrl,
  readinessUrl:
    'https://parkking.onrender.com/api/parking-answer/ready',
  contractSource: options.handoffJsonPath,
  releaseId: '20260718185036_fda8323',
  releaseTag: 'data-20260718185036_fda8323',
  status: 200,
  serviceStatus: 'ok',
  readinessAttempts: 1,
  expectedDatasets: [
    {
      districtId: 'xinyi',
      datasetHash: 'expected-hash',
      publishedAt: '2026-07-18T18:46:26Z',
    },
  ],
  districts: [
    {
      districtId: 'xinyi',
      expectedDatasetHash: 'expected-hash',
      expectedPublishedAt: '2026-07-18T18:46:26Z',
      actualDatasetHash,
      actualPublishedAt: '2026-07-18T18:46:26Z',
      latestDatasetHash: actualDatasetHash,
      latestPublishedAt: '2026-07-18T18:46:26Z',
      ready: true,
      pass,
      errors: pass ? [] : ['dataset hash is still stale'],
    },
  ],
  unexpectedDistricts: [],
  apiServices: null,
  parkingAnswers: null,
  syncCors: null,
  proxyRuntime: null,
  releasePackageRemediation: null,
  remediation: null,
  errors: pass ? [] : ['parking-answer dataset hash mismatch'],
})

describe('waitForRenderRelease', () => {
  it('polls until the live dataset contract matches', async () => {
    let currentTime = 0
    const results = [
      verifyResult(false, 'old-hash'),
      verifyResult(true, 'expected-hash'),
    ]

    const result = await waitForRenderRelease(options, {
      verify: async (verifyOptions) => {
        expect(verifyOptions).toMatchObject({
          appUrl: options.appUrl,
          handoffJsonPath: options.handoffJsonPath,
          timeoutMs: options.requestTimeoutMs,
          skipApiServices: true,
          skipParkingAnswerCases: true,
        })
        return results.shift() ?? verifyResult(true, 'expected-hash')
      },
      now: () => currentTime,
      sleep: async (ms) => {
        currentTime += ms
      },
    })

    expect(result).toMatchObject({
      pass: true,
      attempts: 2,
      elapsedMs: 10,
      errors: [],
    })
  })

  it('fails closed when the release contract never becomes live', async () => {
    let currentTime = 0
    const result = await waitForRenderRelease(
      {
        ...options,
        timeoutMs: 25,
      },
      {
        verify: async () => verifyResult(false, 'old-hash'),
        now: () => currentTime,
        sleep: async (ms) => {
          currentTime += ms
        },
      },
    )

    expect(result.pass).toBe(false)
    expect(result.attempts).toBe(3)
    expect(result.elapsedMs).toBe(25)
    expect(result.errors[0]).toContain('Timed out waiting for Render')
    expect(renderWaitForRenderRelease(result)).toContain(
      '# Render Release Wait: TIMEOUT',
    )
  })

  it('parses workflow options and writes inspectable reports', async () => {
    const parsed = parseWaitForRenderReleaseArgs(
      [
        '--handoff-json',
        '.tmp/release-data/.tmp/render-deployment-handoff.json',
        '--timeout-ms',
        '60000',
        '--interval-ms',
        '5000',
        '--request-timeout-ms',
        '10000',
      ],
      {
        PARKKING_RENDER_APP_URL: 'https://parkking.onrender.com/',
      },
    )
    expect(parsed).toMatchObject({
      appUrl: 'https://parkking.onrender.com',
      timeoutMs: 60000,
      intervalMs: 5000,
      requestTimeoutMs: 10000,
    })

    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-release-wait-'))
    const outPath = path.join(base, 'wait.md')
    const jsonOutPath = path.join(base, 'wait.json')
    const result = await waitForRenderRelease(
      {
        ...parsed,
        outPath,
        jsonOutPath,
      },
      {
        verify: async () => verifyResult(true, 'expected-hash'),
      },
    )
    await writeWaitForRenderReleaseOutputs(result, {
      outPath,
      jsonOutPath,
    })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '# Render Release Wait: PASS',
    )
    await expect(fs.readFile(jsonOutPath, 'utf-8')).resolves.toContain(
      '"pass": true',
    )
  })
})
