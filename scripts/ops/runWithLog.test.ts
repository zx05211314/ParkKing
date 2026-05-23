import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  parseRunWithLogArgs,
  runWithLog,
} from './runWithLog'

describe('runWithLog', () => {
  it('parses command args after the separator', () => {
    expect(
      parseRunWithLogArgs([
        'node',
        'run-with-log',
        '--log',
        'vitest.log',
        '--',
        'npm',
        'test',
      ]),
    ).toEqual({
      logPath: 'vitest.log',
      command: 'npm',
      args: ['test'],
    })
  })

  it('writes process output to the log and returns the exit code', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'run-with-log-'))
    const logPath = path.join(base, 'command.log')
    const exitCode = await runWithLog({
      logPath,
      command: process.execPath,
      args: ['-e', 'console.log("logged output")'],
      echo: false,
    })

    expect(exitCode).toBe(0)
    await expect(fs.readFile(logPath, 'utf-8')).resolves.toContain('logged output')
  }, 15000)

  it('preserves non-zero exit codes while still writing the log', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'run-with-log-'))
    const logPath = path.join(base, 'command.log')
    const exitCode = await runWithLog({
      logPath,
      command: process.execPath,
      args: ['-e', 'console.error("failed output"); process.exit(3)'],
      echo: false,
    })

    expect(exitCode).toBe(3)
    await expect(fs.readFile(logPath, 'utf-8')).resolves.toContain('failed output')
  })
})
