import * as fs from 'node:fs/promises'
import { createServer } from 'node:net'
import * as path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { buildAppServer } from './buildAppServer'

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
        PARKKING_APP_ENABLE_PARKING_ANSWER: 'false',
        PARKKING_APP_ENABLE_SYNC: 'false',
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
      expect(result.bytes).toBeGreaterThan(0)
    } finally {
      await stopChild(child)
      await fs.rm(base, { recursive: true, force: true })
    }
  }, 20_000)
})
