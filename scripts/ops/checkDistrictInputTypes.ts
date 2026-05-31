export type DistrictInputStatus = 'OK' | 'MISSING' | 'INVALID'

export interface DistrictInputChecklistItem {
  key: string
  path: string
  status: DistrictInputStatus
  detail?: string
}

export interface CheckDistrictInputArgs {
  configPath: string | null
}
