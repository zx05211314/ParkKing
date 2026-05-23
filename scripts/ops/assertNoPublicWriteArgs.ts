export const parseAssertNoPublicWriteArgs = (argv: string[]) => {
  const args = [...argv]
  const baselineIndex = args.findIndex((arg) => arg === '--baseline')
  const checkIndex = args.findIndex((arg) => arg === '--check')
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  return {
    baselinePath: baselineIndex >= 0 ? args[baselineIndex + 1] : null,
    checkPath: checkIndex >= 0 ? args[checkIndex + 1] : null,
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] : null,
  }
}
