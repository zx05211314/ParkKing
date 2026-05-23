import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export interface RunWithLogOptions {
  logPath: string
  command: string
  args: string[]
  echo?: boolean
}

const commandForPlatform = (command: string) =>
  process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command

export const parseRunWithLogArgs = (argv: string[]): RunWithLogOptions => {
  const logIndex = argv.indexOf('--log')
  if (logIndex < 0 || !argv[logIndex + 1]) {
    throw new Error('--log is required')
  }
  const separatorIndex = argv.indexOf('--', logIndex + 2)
  if (separatorIndex < 0 || !argv[separatorIndex + 1]) {
    throw new Error('Command is required after --')
  }
  return {
    logPath: argv[logIndex + 1],
    command: argv[separatorIndex + 1],
    args: argv.slice(separatorIndex + 2),
  }
}

export const runWithLog = async ({
  logPath,
  command,
  args,
  echo = true,
}: RunWithLogOptions) => {
  const resolvedLogPath = path.resolve(logPath)
  await fsp.mkdir(path.dirname(resolvedLogPath), { recursive: true })

  return await new Promise<number>((resolve, reject) => {
    const log = fs.createWriteStream(resolvedLogPath, { flags: 'w' })
    const child = spawn(commandForPlatform(command), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    child.stdout.on('data', (chunk: Buffer) => {
      if (echo) {
        process.stdout.write(chunk)
      }
      log.write(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (echo) {
        process.stderr.write(chunk)
      }
      log.write(chunk)
    })
    child.on('error', (error) => {
      log.end()
      reject(error)
    })
    child.on('close', (code) => {
      log.end(() => resolve(code ?? 1))
    })
  })
}

const run = async () => {
  const exitCode = await runWithLog(parseRunWithLogArgs(process.argv))
  process.exit(exitCode)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
