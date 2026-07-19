import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildRenderDashboardEnvPacket,
  parseRenderDashboardEnvPacketArgs,
  renderRenderDashboardEnvPacket,
  writeRenderDashboardEnvPacketOutputs,
} from './renderDashboardEnvPacket'

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

describe('renderDashboardEnvPacket', () => {
  it('builds dashboard values from a production rollout handoff', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-env-packet-'))
    const handoffPath = path.join(base, 'production-rollout-handoff.json')
    await writeJson(handoffPath, {
      packageUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-1/park-king-data_1.zip',
      manifestUrl:
        'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
    })

    const result = await buildRenderDashboardEnvPacket(
      parseRenderDashboardEnvPacketArgs([
        '--handoff-json',
        handoffPath,
        '--app-url',
        'https://parkking.onrender.com',
      ]),
    )
    const rendered = renderRenderDashboardEnvPacket(result)

    expect(result.pass).toBe(true)
    expect(result.envSource).toBe('handoff')
    expect(result.requiredEnv).toMatchObject({
      PARKKING_RELEASE_PACKAGE_URL:
        'https://github.com/zx05211314/ParkKing/releases/download/data-1/park-king-data_1.zip',
      PARKKING_RELEASE_MANIFEST_URL:
        'https://github.com/zx05211314/ParkKing/releases/download/data-1/release_manifest_1.json',
      PARKKING_SYNC_CORS_ORIGINS: 'https://parkking.onrender.com',
      PARKKING_SYNC_MODE: 'issue-upload-only',
      PARKKING_SYNC_DURABILITY: 'ephemeral',
      VITE_SYNC_MODE: 'issue-upload-only',
      PARKKING_GEOCODER_REQUEST_TIMEOUT_MS: '5000',
      PARKKING_ROUTING_REQUEST_TIMEOUT_MS: '8000',
    })
    expect(result.rows.map((row) => row.key)).toEqual([
      'PARKKING_RELEASE_PACKAGE_URL',
      'PARKKING_RELEASE_MANIFEST_URL',
      'PARKKING_SYNC_CORS_ORIGINS',
      'PARKKING_SYNC_MODE',
      'PARKKING_SYNC_DURABILITY',
      'VITE_SYNC_MODE',
      'PARKKING_GEOCODER_REQUEST_TIMEOUT_MS',
      'PARKKING_ROUTING_REQUEST_TIMEOUT_MS',
    ])
    expect(rendered).toContain('# Render Dashboard Env Packet: PASS')
    expect(rendered).toContain('Manual Deploy -> Deploy latest commit')
    expect(rendered).toContain('ops:production-rollout-status')
  })

  it('falls back to renderEnv release URLs and app origin', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-env-packet-'))
    const handoffPath = path.join(base, 'render-deployment-handoff.json')
    await writeJson(handoffPath, {
      renderEnv: {
        PARKKING_RELEASE_PACKAGE_URL: 'https://example.test/data.zip',
        PARKKING_RELEASE_MANIFEST_URL: 'https://example.test/manifest.json',
      },
    })

    const result = await buildRenderDashboardEnvPacket(
      parseRenderDashboardEnvPacketArgs([
        '--handoff-json',
        handoffPath,
        '--app-url',
        'https://parkking.onrender.com/path?ignored=true',
      ]),
    )

    expect(result.pass).toBe(true)
    expect(result.requiredEnv.PARKKING_SYNC_CORS_ORIGINS).toBe(
      'https://parkking.onrender.com',
    )
    expect(result.releasePackageUrl).toBe('https://example.test/data.zip')
    expect(result.releaseManifestUrl).toBe('https://example.test/manifest.json')
  })

  it('skips a placeholder production rollout handoff when choosing defaults', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-env-packet-cwd-'))
    const oldCwd = process.cwd()
    try {
      process.chdir(base)
      await writeJson(path.join(base, '.tmp', 'production-rollout-handoff.json'), {
        packageUrl:
          'https://github.com/owner/repo/releases/download/data-1/park-king-data_1.zip',
        manifestUrl:
          'https://github.com/owner/repo/releases/download/data-1/release_manifest_1.json',
      })
      await writeJson(path.join(base, '.tmp', 'render-deployment-handoff.json'), {
        packageUrl: 'https://github.com/zx05211314/ParkKing/releases/data.zip',
        manifestUrl:
          'https://github.com/zx05211314/ParkKing/releases/manifest.json',
      })

      const result = await buildRenderDashboardEnvPacket(
        parseRenderDashboardEnvPacketArgs([
          '--app-url',
          'https://parkking.onrender.com',
        ]),
      )

      expect(result.pass).toBe(true)
      expect(result.handoffJsonPath).toBe('.tmp/render-deployment-handoff.json')
      expect(result.releasePackageUrl).toBe(
        'https://github.com/zx05211314/ParkKing/releases/data.zip',
      )
    } finally {
      process.chdir(oldCwd)
    }
  })

  it('fails when an explicit handoff still contains placeholder release URLs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-env-packet-'))
    const handoffPath = path.join(base, 'handoff.json')
    await writeJson(handoffPath, {
      packageUrl:
        'https://github.com/owner/repo/releases/download/data-1/park-king-data_1.zip',
      manifestUrl:
        'https://github.com/owner/repo/releases/download/data-1/release_manifest_1.json',
    })

    const result = await buildRenderDashboardEnvPacket(
      parseRenderDashboardEnvPacketArgs([
        '--handoff-json',
        handoffPath,
        '--app-url',
        'https://parkking.onrender.com',
      ]),
    )

    expect(result.pass).toBe(false)
    expect(result.errors.join('\n')).toContain('placeholder owner/repo')
  })

  it('fails without release URLs unless runtime-only mode is requested', async () => {
    const result = await buildRenderDashboardEnvPacket(
      parseRenderDashboardEnvPacketArgs([
        '--handoff-json',
        path.join(tmpdir(), 'missing-render-handoff.json'),
        '--app-url',
        'https://parkking.onrender.com',
      ]),
    )

    expect(result.pass).toBe(false)
    expect(result.errors.join('\n')).toContain('Missing release URLs')

    const runtimeOnly = await buildRenderDashboardEnvPacket(
      parseRenderDashboardEnvPacketArgs([
        '--runtime-only',
        '--app-url',
        'https://parkking.onrender.com',
      ]),
    )
    expect(runtimeOnly.pass).toBe(true)
    expect(runtimeOnly.requiredEnv.PARKKING_RELEASE_PACKAGE_URL).toBeUndefined()
    expect(runtimeOnly.warnings.join('\n')).toContain('Runtime-only mode')
  })

  it('writes markdown and JSON packets', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'render-env-packet-'))
    const outPath = path.join(base, 'packet.md')
    const jsonOutPath = path.join(base, 'packet.json')
    const result = await buildRenderDashboardEnvPacket(
      parseRenderDashboardEnvPacketArgs([
        '--package-url',
        'https://example.test/data.zip',
        '--manifest-url',
        'https://example.test/manifest.json',
        '--app-url',
        'https://parkking.onrender.com',
        '--out',
        outPath,
        '--json-out',
        jsonOutPath,
      ]),
    )

    await writeRenderDashboardEnvPacketOutputs(result, { outPath, jsonOutPath })

    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      '$env:PARKKING_RELEASE_PACKAGE_URL="https://example.test/data.zip"',
    )
    await expect(fs.readFile(jsonOutPath, 'utf-8')).resolves.toContain(
      '"pass": true',
    )
  })
})
