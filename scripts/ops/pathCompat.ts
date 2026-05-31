import * as path from 'node:path'

const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/
const WINDOWS_UNC_RE = /^\\\\[^\\]+\\[^\\]+/

export const isWindowsAbsolutePath = (value: string) =>
  WINDOWS_ABSOLUTE_RE.test(value) || WINDOWS_UNC_RE.test(value)

export const isAbsoluteCompat = (value: string) =>
  path.isAbsolute(value) || isWindowsAbsolutePath(value)

const shouldUseWin32Path = (values: string[]) =>
  values.some((value) => isWindowsAbsolutePath(value))

export const resolveCompat = (...values: string[]) =>
  shouldUseWin32Path(values) ? path.win32.resolve(...values) : path.resolve(...values)

export const relativeCompat = (from: string, to: string) =>
  shouldUseWin32Path([from, to])
    ? path.win32.relative(from, to)
    : path.relative(from, to)
