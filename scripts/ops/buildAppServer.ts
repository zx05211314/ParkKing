import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const DEFAULT_ENTRY_POINT = 'scripts/ops/appServerEntry.ts'
const DEFAULT_OUT_PATH = 'dist-server/appServer.cjs'

export interface BuildAppServerOptions {
  entryPoint?: string | null
  outPath?: string | null
}

export interface BuildAppServerResult {
  entryPoint: string
  outPath: string
  bytes: number
}

export const buildAppServer = async (
  options: BuildAppServerOptions = {},
): Promise<BuildAppServerResult> => {
  const entryPoint = path.resolve(options.entryPoint ?? DEFAULT_ENTRY_POINT)
  const outPath = path.resolve(options.outPath ?? DEFAULT_OUT_PATH)
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await build({
    entryPoints: [entryPoint],
    outfile: outPath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    logOverride: {
      'empty-import-meta': 'silent',
    },
  })
  const stat = await fs.stat(outPath)
  return {
    entryPoint,
    outPath,
    bytes: stat.size,
  }
}

const run = async () => {
  const result = await buildAppServer()
  console.log(
    `Built ParkKing app server: ${result.outPath} (${result.bytes} bytes)`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
