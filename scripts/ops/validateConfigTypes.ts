export interface ConfigIssue {
  configPath: string
  errors: string[]
  warnings: string[]
}

export interface ValidateOptions {
  configsDir?: string
  configsGlob?: string
  allowAbsolute?: boolean
}
