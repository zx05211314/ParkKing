import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { DiffReport } from './notifyNightlyTypes'

const nightlyFileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const readNightlyDiffReport = async (filePath: string): Promise<DiffReport> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as DiffReport
}

export const resolveNightlyDiffPaths = async (inputs: string[]): Promise<string[]> => {
  if (inputs.length === 0 || inputs.some((input) => !input)) {
    throw new Error('Usage: tsx notifyNightly.ts --diff <path>')
  }

  const resolved: string[] = []
  for (const input of inputs) {
    const candidate = path.resolve(input)
    if (!(await nightlyFileExists(candidate))) {
      throw new Error(`Diff path not found: ${input}`)
    }
    const stat = await fs.stat(candidate)
    if (stat.isDirectory()) {
      const diffFile = path.resolve(candidate, 'diff_report.json')
      if (!(await nightlyFileExists(diffFile))) {
        throw new Error(`diff_report.json not found in ${candidate}`)
      }
      resolved.push(diffFile)
    } else {
      resolved.push(candidate)
    }
  }

  return Array.from(new Set(resolved)).sort((a, b) => a.localeCompare(b))
}
