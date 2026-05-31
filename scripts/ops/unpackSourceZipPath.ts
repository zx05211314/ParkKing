export const normalizeZipPath = (value: string) => {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/, '')
  return normalized.replace(/\/+/g, '/')
}

export const hasZipExt = (filePath: string, ext: string) =>
  filePath.toLowerCase().endsWith(ext.toLowerCase())

export const stripZipExt = (filePath: string) => filePath.replace(/\.[^./\\]+$/u, '')
