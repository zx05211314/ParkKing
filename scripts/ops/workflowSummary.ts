import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'

type Env = NodeJS.ProcessEnv

export type WorkflowSummaryEvent =
  | { type: 'appendFile'; filePath: string }
  | { type: 'appendGlob'; pattern: string }
  | { type: 'appendText'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'link'; label: string; url: string }
  | { type: 'envLink'; label: string; envName: string }

export interface WorkflowSummaryOptions {
  summaryPath?: string | null
  events: WorkflowSummaryEvent[]
}

export interface WorkflowSummaryResult {
  summaryPath: string | null
  appended: boolean
  appendedFiles: string[]
  skippedFiles: string[]
  skippedLinks: string[]
  linesWritten: number
}

const nextArg = (argv: string[], index: number, flag: string) => {
  const value = argv[index + 1]
  if (!value) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

const parseKeyValue = (value: string, flag: string) => {
  const separatorIndex = value.indexOf('=')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(`${flag} must use label=value`)
  }
  return {
    label: value.slice(0, separatorIndex).trim(),
    value: value.slice(separatorIndex + 1).trim(),
  }
}

export const parseWorkflowSummaryArgs = (
  argv: string[],
): WorkflowSummaryOptions => {
  let summaryPath: string | null | undefined
  const events: WorkflowSummaryEvent[] = []

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--summary') {
      summaryPath = nextArg(argv, index, arg)
      index += 1
    } else if (arg === '--append-file') {
      events.push({ type: 'appendFile', filePath: nextArg(argv, index, arg) })
      index += 1
    } else if (arg === '--append-glob') {
      events.push({ type: 'appendGlob', pattern: nextArg(argv, index, arg) })
      index += 1
    } else if (arg === '--heading') {
      events.push({ type: 'heading', text: nextArg(argv, index, arg) })
      index += 1
    } else if (arg === '--link') {
      const parsed = parseKeyValue(nextArg(argv, index, arg), arg)
      events.push({ type: 'link', label: parsed.label, url: parsed.value })
      index += 1
    } else if (arg === '--env-link') {
      const parsed = parseKeyValue(nextArg(argv, index, arg), arg)
      events.push({ type: 'envLink', label: parsed.label, envName: parsed.value })
      index += 1
    } else {
      throw new Error(`Unknown workflow summary option: ${arg}`)
    }
  }

  return { summaryPath, events }
}

const pathExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const pushBlock = (lines: string[], block: string) => {
  const trimmed = block.trimEnd()
  if (!trimmed) {
    return
  }
  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('')
  }
  lines.push(...trimmed.split(/\r?\n/u))
}

const appendHeading = (lines: string[], text: string) => {
  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('')
  }
  lines.push(`## ${text.trim()}`)
}

const readAppendFile = async (filePath: string) => {
  const resolved = path.resolve(filePath)
  if (!(await pathExists(resolved))) {
    return null
  }
  return {
    filePath: resolved,
    content: await fs.readFile(resolved, 'utf-8'),
  }
}

const resolveSummaryPath = (summaryPath: string | null | undefined, env: Env) =>
  summaryPath === undefined ? (env.GITHUB_STEP_SUMMARY?.trim() || null) : summaryPath

export const appendWorkflowSummary = async (
  options: WorkflowSummaryOptions,
  env: Env = process.env,
): Promise<WorkflowSummaryResult> => {
  const summaryPath = resolveSummaryPath(options.summaryPath, env)
  const appendedFiles: string[] = []
  const skippedFiles: string[] = []
  const skippedLinks: string[] = []
  const lines: string[] = []

  for (const event of options.events) {
    if (event.type === 'appendGlob') {
      const pattern = event.pattern.replace(/\\/g, '/')
      const matches = (
        await fg(pattern, { onlyFiles: true, dot: false, absolute: false })
      ).sort((left, right) => left.localeCompare(right))
      if (matches.length === 0) {
        skippedFiles.push(event.pattern)
      }
      for (const match of matches) {
        const file = await readAppendFile(match)
        if (!file) {
          skippedFiles.push(match)
          continue
        }
        pushBlock(lines, file.content)
        appendedFiles.push(file.filePath)
      }
    } else if (event.type === 'appendFile') {
      const file = await readAppendFile(event.filePath)
      if (!file) {
        skippedFiles.push(event.filePath)
        continue
      }
      pushBlock(lines, file.content)
      appendedFiles.push(file.filePath)
    } else if (event.type === 'appendText') {
      pushBlock(lines, event.text)
    } else if (event.type === 'heading') {
      appendHeading(lines, event.text)
    } else if (event.type === 'link') {
      if (event.url.trim()) {
        lines.push(`- [${event.label}](${event.url.trim()})`)
      } else {
        skippedLinks.push(event.label)
      }
    } else {
      const url = env[event.envName]?.trim() ?? ''
      if (url) {
        lines.push(`- [${event.label}](${url})`)
      } else {
        skippedLinks.push(`${event.label}=${event.envName}`)
      }
    }
  }

  const output = lines.join('\n').trimEnd()
  if (summaryPath && output) {
    const resolved = path.resolve(summaryPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.appendFile(resolved, `${output}\n\n`, 'utf-8')
  }

  return {
    summaryPath: summaryPath ? path.resolve(summaryPath) : null,
    appended: Boolean(summaryPath && output),
    appendedFiles,
    skippedFiles,
    skippedLinks,
    linesWritten: output ? output.split(/\r?\n/u).length : 0,
  }
}

const formatResult = (result: WorkflowSummaryResult) =>
  [
    `Workflow summary append: ${result.appended ? 'WROTE' : 'SKIPPED'}`,
    `Summary: ${result.summaryPath ?? '-'}`,
    `Files appended: ${result.appendedFiles.length}`,
    `Files skipped: ${result.skippedFiles.length}`,
    `Links skipped: ${result.skippedLinks.length}`,
  ].join('\n')

const run = async () => {
  const result = await appendWorkflowSummary(parseWorkflowSummaryArgs(process.argv))
  console.log(formatResult(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
