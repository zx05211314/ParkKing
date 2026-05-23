export const parseSmokePublicDataArgs = (argv: string[]) => {
  const args = [...argv]
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  return {
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] ?? null : null,
  }
}
