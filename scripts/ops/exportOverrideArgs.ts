import * as path from 'node:path'

import type { ExportOverridesArgs } from './exportOverrideTypes'

export const parseExportOverridesArgs = (argv: string[]): ExportOverridesArgs => {
  const args = [...argv]
  const inputIndex = args.findIndex((arg) => arg === '--input')
  const outIndex = args.findIndex((arg) => arg === '--outDir')
  return {
    inputPath: inputIndex >= 0 ? args[inputIndex + 1] : null,
    outDir: outIndex >= 0 ? args[outIndex + 1] : path.resolve('data', 'overrides'),
  }
}
