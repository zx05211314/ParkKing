export interface NewDistrictOptions {
  districtId: string
  districtName: string
  sourceRoot: string
  force: boolean
}

export interface NewDistrictCliArgs {
  districtId: string | null
  districtName: string | null
  sourceRoot: string | null
  force: boolean
}
