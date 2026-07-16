export const shouldApplyDatasetMapFocus = (params: {
  focusBoundsKey?: string | null
  focusCenterKey?: string | null
}) => !params.focusBoundsKey && !params.focusCenterKey
