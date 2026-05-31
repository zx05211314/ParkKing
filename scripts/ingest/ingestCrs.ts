import proj4 from 'proj4'

export const EPSG_3826 = 'EPSG:3826'
export const EPSG_4326 = 'EPSG:4326'

proj4.defs(
  EPSG_3826,
  '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs',
)
