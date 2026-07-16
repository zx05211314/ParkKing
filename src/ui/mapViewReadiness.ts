export type DatasetLoadStatus = 'loading' | 'ready' | 'error'

export const shouldMountMapView = (datasetStatus: DatasetLoadStatus) =>
  datasetStatus === 'ready'
