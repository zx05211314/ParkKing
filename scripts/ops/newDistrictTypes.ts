export type NewDistrictSourcePreset = 'raw-district' | 'taipei-shared'

export interface NewDistrictOptions {
  districtId: string
  districtName: string
  sourceRoot: string
  outputRoot?: string | null
  sourcePreset?: NewDistrictSourcePreset | null
  boundaryFeatureId?: string | null
  boundaryName?: string | null
  force: boolean
}

export interface NewDistrictCliArgs {
  districtId: string | null
  districtName: string | null
  sourceRoot: string | null
  outputRoot: string | null
  sourcePreset: NewDistrictSourcePreset | null
  boundaryFeatureId: string | null
  boundaryName: string | null
  force: boolean
}
