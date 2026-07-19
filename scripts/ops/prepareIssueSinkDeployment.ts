import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_TEMPLATE_PATH =
  'infra/issue-sink/wrangler.example.jsonc'
const DEFAULT_OUTPUT_PATH = 'infra/issue-sink/wrangler.jsonc'
const DATABASE_ID_PLACEHOLDER = '__D1_DATABASE_ID__'
const DATABASE_ID_PATTERN = /^[a-f0-9-]{20,}$/i

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export interface PrepareIssueSinkDeploymentOptions {
  databaseId: string
  templatePath?: string
  outputPath?: string
}

export const prepareIssueSinkDeployment = async ({
  databaseId,
  templatePath = DEFAULT_TEMPLATE_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
}: PrepareIssueSinkDeploymentOptions) => {
  const normalizedDatabaseId = databaseId.trim()
  if (!DATABASE_ID_PATTERN.test(normalizedDatabaseId)) {
    throw new Error('D1 database id is missing or invalid.')
  }

  const template = await fs.readFile(templatePath, 'utf8')
  if (!template.includes(DATABASE_ID_PLACEHOLDER)) {
    throw new Error(
      `Issue sink template does not contain ${DATABASE_ID_PLACEHOLDER}.`,
    )
  }
  const output = template.replaceAll(
    DATABASE_ID_PLACEHOLDER,
    normalizedDatabaseId,
  )
  const resolvedOutputPath = path.resolve(outputPath)
  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true })
  await fs.writeFile(resolvedOutputPath, output, 'utf8')
  return {
    databaseId: normalizedDatabaseId,
    outputPath: resolvedOutputPath,
  }
}

const run = async () => {
  const argv = process.argv.slice(2)
  const databaseId =
    getArgValue(argv, '--database-id') ??
    process.env.PARKKING_ISSUE_SINK_D1_DATABASE_ID ??
    ''
  const result = await prepareIssueSinkDeployment({
    databaseId,
    templatePath:
      getArgValue(argv, '--template') ?? DEFAULT_TEMPLATE_PATH,
    outputPath: getArgValue(argv, '--out') ?? DEFAULT_OUTPUT_PATH,
  })
  console.log('# ParkKing Issue Sink Deployment Config: PASS')
  console.log(`- D1 database: ${result.databaseId}`)
  console.log(`- Config: ${result.outputPath}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
