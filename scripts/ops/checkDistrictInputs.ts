import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCheckDistrictInputArgs } from './checkDistrictInputArgs'
import {
  readDistrictInputConfig,
} from './checkDistrictInputConfig'
import { validateDistrictInput } from './checkDistrictInputValidation'

export const checkDistrictInputs = async (configPath: string) => {
  const configDir = path.dirname(configPath)
  const { inputs, requiredKeys } = await readDistrictInputConfig(configPath)

  const checklist = []

  for (const [key, value] of Object.entries(inputs)) {
    if (!value) {
      continue
    }
    checklist.push(await validateDistrictInput({ configDir, key, value }))
  }

  const missingRequired = requiredKeys.filter(
    (key) => !inputs[key] || checklist.find((item) => item.key === key)?.status !== 'OK',
  )

  console.table(
    checklist.map((item) => ({
      input: item.key,
      path: item.path,
      status: item.status,
      detail: item.detail ?? '',
    })),
  )

  if (missingRequired.length > 0) {
    throw new Error(`Missing required inputs: ${missingRequired.join(', ')}`)
  }

  return checklist
}

const run = async () => {
  const args = parseCheckDistrictInputArgs(process.argv)
  if (!args.configPath) {
    throw new Error('Usage: tsx scripts/ops/checkDistrictInputs.ts --config <path>')
  }
  await checkDistrictInputs(args.configPath)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
