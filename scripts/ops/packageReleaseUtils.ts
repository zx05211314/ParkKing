import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'

export const readReleaseJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export const sha256Buffer = (buffer: Buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex')

export const buildReleaseTimestampId = (now = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate(),
  )}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
}

export const validateReleaseId = (value: string) => {
  const releaseId = value.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(releaseId)) {
    throw new Error(
      'Release ID must start with an alphanumeric character and contain only letters, numbers, dots, underscores, or hyphens',
    )
  }
  return releaseId
}

export const getGitShortSha = () => {
  try {
    const stdout = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return stdout.toString().trim()
  } catch {
    return 'nogit'
  }
}

export const resolveReleaseManifestPath = (baseDir: string, manifestPath?: string) => {
  if (!manifestPath) {
    return null
  }
  const normalized = manifestPath.replace(/\\/g, '/')
  if (path.isAbsolute(normalized)) {
    return normalized
  }
  return path.resolve(baseDir, normalized)
}
