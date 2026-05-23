import * as path from 'node:path'

export const normalizeConfigPath = (value: string) => value.replace(/\\/g, '/')

export const isHomePath = (value: string) => {
  const home = process.env.HOME || process.env.USERPROFILE
  if (!home) {
    return false
  }
  const normalized = normalizeConfigPath(path.resolve(value))
  const normalizedHome = normalizeConfigPath(path.resolve(home))
  return normalized.startsWith(normalizedHome)
}

export const isDriveRoot = (value: string) => {
  const resolved = path.resolve(value)
  const root = path.parse(resolved).root
  return resolved === root
}

export const isRelativeConfigPath = (value: string) => !path.isAbsolute(value)

export const validateConfigPath = (
  value: string,
  allowAbsolute: boolean,
  errors: string[],
  label: string,
) => {
  if (!allowAbsolute && !isRelativeConfigPath(value)) {
    errors.push(`${label} must be a relative path`)
  }
  if (path.isAbsolute(value)) {
    if (isHomePath(value)) {
      errors.push(`${label} must not point to a user home directory`)
    }
    if (isDriveRoot(value)) {
      errors.push(`${label} must not point to a drive root`)
    }
  }
}
