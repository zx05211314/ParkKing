export const normalizeDistrictId = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) {
    return 'district'
  }
  const dashed = trimmed.replace(/[\s_]+/g, '-')
  const normalized = dashed.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  return normalized.replace(/^-+|-+$/g, '') || 'district'
}

export const getBoundaryFileName = (districtId: string) => {
  const slug = normalizeDistrictId(districtId)
  return `${slug}_boundary.geojson`
}
