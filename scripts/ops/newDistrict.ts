import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NEW_DISTRICT_USAGE, parseArgs } from './newDistrictArgs'
import { buildNewDistrictConfig } from './newDistrictConfig'
import type { NewDistrictOptions } from './newDistrictTypes'

export const newDistrict = async (options: NewDistrictOptions) => {
  const configPath = path.resolve(
    'configs',
    'prod',
    `${options.districtId}.json`,
  )
  try {
    await fs.access(configPath)
    if (!options.force) {
      throw new Error(`Config already exists at ${configPath} (use --force)`)
    }
  } catch {
    // OK to write
  }

  const payload = buildNewDistrictConfig(options)
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  console.log(`Wrote ${configPath}`)
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.districtId || !args.districtName || !args.sourceRoot) {
    throw new Error(NEW_DISTRICT_USAGE)
  }
  await newDistrict({
    districtId: args.districtId,
    districtName: args.districtName,
    sourceRoot: args.sourceRoot,
    force: args.force,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
