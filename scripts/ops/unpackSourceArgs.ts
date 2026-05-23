export const parseUnpackSourceArgs = (argv: string[]) => {
  const args = [...argv]
  const sourceIndex = args.findIndex((arg) => arg === '--sourceDir')
  return {
    sourceDir: sourceIndex >= 0 ? args[sourceIndex + 1] : null,
  }
}
