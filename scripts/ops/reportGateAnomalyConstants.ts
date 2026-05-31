export const DEFAULT_DATASET_ROOTS = ['public/data/generated', 'data/generated']

export const KNOWN_LAYER_FILES = [
  'red_yellow.geojson',
  'bus_stops.geojson',
  'hydrants.geojson',
  'intersections.geojson',
  'crosswalks.geojson',
  'sign_overrides.geojson',
  'candidates_inferred.geojson',
  'overrides_applied.geojson',
]

export const DELTA_FIELDS = [
  { field: 'segmentsCount', layer: 'red_yellow.geojson' },
  { field: 'overridesAppliedCount', layer: 'overrides_applied.geojson' },
  { field: 'signOverridesCount', layer: 'sign_overrides.geojson' },
  { field: 'signOverrideUnmatchedNamedCount', layer: 'dataset_meta.json' },
  { field: 'curbMarkingKnownRate', layer: 'dataset_meta.json' },
  { field: 'restrictionTriggeredRate', layer: 'dataset_meta.json' },
] as const
