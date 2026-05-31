export const parseCleanupBackupsArgs = (argv: string[]) => {
  const args = [...argv]
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  const maxIndex = args.findIndex((arg) => arg === '--maxBackups')
  const ageIndex = args.findIndex((arg) => arg === '--maxAgeDays')

  return {
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] : null,
    maxBackups: maxIndex >= 0 ? Number(args[maxIndex + 1]) : null,
    maxAgeDays: ageIndex >= 0 ? Number(args[ageIndex + 1]) : null,
  }
}
