import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSignOverridePreflightArgs } from './signOverridePreflightArgs'
import { formatSignOverridePreflight } from './signOverridePreflightOutput'
import { buildSignOverridePreflight } from './signOverridePreflightState'

export const runSignOverridePreflight = async (argv: string[] = process.argv) => {
  const args = parseSignOverridePreflightArgs(argv)
  if (!args.configPath) {
    throw new Error(
      'Usage: tsx signOverridePreflight.ts --config <path> [--input data/overrides/<district>.jsonl] [--json] [--out <path>]',
    )
  }

  const result = await buildSignOverridePreflight(args.configPath, args.inputPath)
  const output = args.json ? JSON.stringify(result, null, 2) : formatSignOverridePreflight(result)

  if (args.outPath) {
    const resolved = path.resolve(args.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${output}\n`, 'utf-8')
  }

  console.log(output)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSignOverridePreflight().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
