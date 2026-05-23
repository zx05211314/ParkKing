export const parseSyncPublicDataArgs = (argv: string[]) => {
  const args = [...argv]
  const sourceIndex = args.findIndex((arg) => arg === '--source')
  const targetIndex = args.findIndex((arg) => arg === '--target')
  return {
    sourceDir: sourceIndex >= 0 ? args[sourceIndex + 1] ?? null : null,
    targetDir: targetIndex >= 0 ? args[targetIndex + 1] ?? null : null,
  }
}
