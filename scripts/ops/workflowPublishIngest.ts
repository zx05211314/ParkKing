import { fileURLToPath } from 'node:url'
import { runIngestAll } from '../ingest/ingestAll'

type Env = NodeJS.ProcessEnv

export interface WorkflowPublishIngestOptions {
  configs?: string | null
  configsEnv?: string | null
  allowWarn?: boolean | null
  allowWarnEnv?: string | null
  overrideReason?: string | null
  overrideReasonEnv?: string | null
}

const defaultEnvNames = {
  configs: 'CONFIGS_GLOB',
  allowWarn: 'ALLOW_WARN',
  overrideReason: 'OVERRIDE_REASON',
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const normalizeText = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

const parseBooleanText = (value: string | null | undefined) =>
  normalizeText(value)?.toLowerCase() === 'true'

export const parseWorkflowPublishIngestArgs = (
  argv: string[],
): WorkflowPublishIngestOptions => ({
  configs: getArgValue(argv, '--configs'),
  configsEnv: getArgValue(argv, '--configs-env', '--configsEnv'),
  allowWarn:
    hasFlag(argv, '--allow-warn', '--allowWarn')
      ? true
      : hasFlag(argv, '--no-allow-warn', '--noAllowWarn')
        ? false
        : null,
  allowWarnEnv: getArgValue(argv, '--allow-warn-env', '--allowWarnEnv'),
  overrideReason: getArgValue(argv, '--override', '--override-reason', '--overrideReason'),
  overrideReasonEnv: getArgValue(argv, '--override-env', '--overrideReasonEnv'),
})

const envByName = (env: Env, name: string | null | undefined) =>
  name ? normalizeText(env[name]) : null

export const resolveWorkflowPublishIngestArgv = (
  options: WorkflowPublishIngestOptions,
  env: Env = process.env,
) => {
  const configs =
    normalizeText(options.configs) ??
    envByName(env, options.configsEnv ?? defaultEnvNames.configs)
  const allowWarn =
    options.allowWarn ??
    parseBooleanText(envByName(env, options.allowWarnEnv ?? defaultEnvNames.allowWarn))
  const overrideReason =
    normalizeText(options.overrideReason) ??
    envByName(env, options.overrideReasonEnv ?? defaultEnvNames.overrideReason)

  if (!configs) {
    throw new Error('Missing publish configs. Set CONFIGS_GLOB or pass --configs.')
  }
  if (allowWarn && !overrideReason) {
    throw new Error('overrideReason is required when allowWarn=true')
  }

  const argv = ['node', 'ingestAll', '--configs', configs]
  if (allowWarn) {
    argv.push('--allowWarn', '--override', overrideReason!)
  }
  return argv
}

export const runWorkflowPublishIngest = async (
  options: WorkflowPublishIngestOptions,
  env: Env = process.env,
  runner: (argv: string[]) => Promise<void> = runIngestAll,
) => {
  const argv = resolveWorkflowPublishIngestArgv(options, env)
  await runner(argv)
  return argv
}

const run = async () => {
  const argv = await runWorkflowPublishIngest(
    parseWorkflowPublishIngestArgs(process.argv),
  )
  console.log(`Workflow publish ingest completed for ${argv[3]}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
