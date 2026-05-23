export const parseValidateConfigArgs = (argv: string[]) => {
  const args = [...argv]
  const dirIndex = args.findIndex((arg) => arg === '--dir')
  const globIndex = args.findIndex((arg) => arg === '--configs')
  const allowAbsolute = args.includes('--allowAbsolute')
  return {
    configsDir: dirIndex >= 0 ? args[dirIndex + 1] : null,
    configsGlob: globIndex >= 0 ? args[globIndex + 1] : null,
    allowAbsolute,
  }
}
