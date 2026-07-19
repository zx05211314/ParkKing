import * as fs from 'node:fs/promises'
import { createServer } from 'node:net'
import * as path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ZONE_PARAMS_VERSION } from '../../src/domain/zones/makeZones'
import { buildAppServer } from './buildAppServer'
import { REQUIRED_PARKING_ANSWER_DATASET_FILES } from './parkingAnswerServiceHealth'

const TEST_DISTRICT = 'bundle-test'
const TEST_DATASET_HASH = 'bundle-test-hash'
const TEST_SEGMENT_ID = 'seg-bundle-test'

const createParkingAnswerFixture = async (base: string) => {
  const datasetRoot = path.join(base, 'generated')
  const datasetDir = path.join(datasetRoot, TEST_DISTRICT)
  const indexRoot = path.join(base, 'parking-answer-index')
  await fs.mkdir(datasetDir, { recursive: true })
  await fs.mkdir(indexRoot, { recursive: true })
  await Promise.all(
    REQUIRED_PARKING_ANSWER_DATASET_FILES.map((fileName) =>
      fs.writeFile(
        path.join(datasetDir, fileName),
        JSON.stringify(
          fileName === 'dataset_meta.json'
            ? { datasetHash: TEST_DATASET_HASH }
            : { type: 'FeatureCollection', features: [] },
        ),
        'utf-8',
      ),
    ),
  )
  await fs.writeFile(
    path.join(indexRoot, `${TEST_DISTRICT}.json`),
    JSON.stringify({
      schemaVersion: 1,
      districtId: TEST_DISTRICT,
      datasetHash: TEST_DATASET_HASH,
      zoneParamsVersion: ZONE_PARAMS_VERSION,
      reviewedSignOverridesCount: 1,
      appliedSignOverridesCount: 1,
      segments: [
        {
          id: TEST_SEGMENT_ID,
          name: 'Bundle test yellow curb',
          curbMarking: 'YELLOW',
          confidence: 'HIGH',
          path: [
            [121.56, 25.03],
            [121.561, 25.03],
          ],
          parkingSpaceCount: 1,
          sourceReliability: 'HIGH',
          dataFreshnessDays: 1,
        },
      ],
      zones: [],
    }),
    'utf-8',
  )
  return { datasetRoot, indexRoot }
}

const reservePort = async () => {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Could not reserve an app server test port')
  }
  const port = address.port
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

const stopChild = async (child: ChildProcess) => {
  if (child.exitCode !== null) {
    return
  }
  child.kill()
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ])
}

describe('buildAppServer', () => {
  it('builds a plain Node server that serves health and static routes', async () => {
    const testRoot = path.resolve('.tmp')
    await fs.mkdir(testRoot, { recursive: true })
    const base = await fs.mkdtemp(path.join(testRoot, 'app-server-build-test-'))
    const staticDir = path.join(base, 'static')
    const outPath = path.join(base, 'appServer.cjs')
    await fs.mkdir(staticDir, { recursive: true })
    await fs.writeFile(
      path.join(staticDir, 'index.html'),
      '<div id="root">ParkKing</div>\n',
      'utf-8',
    )
    const { datasetRoot, indexRoot } =
      await createParkingAnswerFixture(base)
    const result = await buildAppServer({ outPath })
    const port = await reservePort()
    const child = spawn(process.execPath, [result.outPath], {
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        PARKKING_APP_HOST: '127.0.0.1',
        PARKKING_APP_PORT: String(port),
        PARKKING_APP_STATIC_DIR: staticDir,
        PARKKING_APP_ENABLE_GEOCODER: 'false',
        PARKKING_APP_ENABLE_ROUTING: 'false',
        PARKKING_APP_ENABLE_PARKING_ANSWER: 'true',
        PARKKING_APP_ENABLE_SYNC: 'false',
        PARKKING_PARKING_ANSWER_DATASET_ROOT: datasetRoot,
        PARKKING_PARKING_ANSWER_INDEX_ROOT: indexRoot,
        PARKKING_PARKING_ANSWER_DEFAULT_DISTRICT: TEST_DISTRICT,
        PARKKING_PARKING_ANSWER_DISTRICTS: TEST_DISTRICT,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })

    try {
      const deadline = Date.now() + 10_000
      let healthResponse: Response | null = null
      while (Date.now() < deadline && child.exitCode === null) {
        try {
          healthResponse = await fetch(`http://127.0.0.1:${port}/api/app/health`)
          break
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }

      expect(child.exitCode, stderr).toBeNull()
      expect(healthResponse?.status, stderr).toBe(200)
      const rootResponse = await fetch(`http://127.0.0.1:${port}/`)
      expect(rootResponse.status).toBe(200)
      await expect(rootResponse.text()).resolves.toContain('ParkKing')
      const readyResponse = await fetch(
        `http://127.0.0.1:${port}/api/parking-answer/ready`,
      )
      expect(readyResponse.status).toBe(200)
      const answerUrl = new URL(`http://127.0.0.1:${port}/api/parking-answer`)
      answerUrl.search = new URLSearchParams({
        district: TEST_DISTRICT,
        lng: '121.5605',
        lat: '25.03005',
        hhmm: '21:00',
        radius: '25',
      }).toString()
      const answerResponse = await fetch(answerUrl)
      const answerPayload = (await answerResponse.json()) as {
        schemaVersion?: unknown
        answer?: {
          kind?: unknown
          primary?: { id?: unknown }
        }
      }
      expect(answerResponse.status, JSON.stringify(answerPayload)).toBe(200)
      expect(answerPayload.schemaVersion).toBe(1)
      expect(answerPayload.answer?.kind).toBe('PARK')
      expect(answerPayload.answer?.primary?.id).toBe(TEST_SEGMENT_ID)
      expect(result.bytes).toBeGreaterThan(0)
    } finally {
      await stopChild(child)
      await fs.rm(base, { recursive: true, force: true })
    }
  }, 30_000)
})
