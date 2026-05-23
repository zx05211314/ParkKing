export const parsePackageReleaseArgs = (argv: string[]) => {
  const args = [...argv]
  const outIndex = args.findIndex((arg) => arg === '--outDir')
  const includeIndex = args.findIndex((arg) => arg === '--include')
  const registryIndex = args.findIndex((arg) => arg === '--registry')
  const districtIndex = args.findIndex((arg) => arg === '--district')
  const districtIds =
    districtIndex >= 0
      ? args[districtIndex + 1]
          ?.split(',')
          .map((district) => district.trim())
          .filter(Boolean) ?? []
      : []

  return {
    outDir: outIndex >= 0 ? args[outIndex + 1] : null,
    include: includeIndex >= 0 ? args[includeIndex + 1] : null,
    registry: registryIndex >= 0 ? args[registryIndex + 1] : null,
    districtIds,
  }
}
