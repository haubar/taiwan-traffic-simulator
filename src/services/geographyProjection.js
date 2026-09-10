import geography from '../data/geography.json' with { type: 'json' }

export const applyGeography = (station) => {
  const point = geography.stations[station.id]
  if (!point) return station
  const [lat, lon] = point
  const { minLon, maxLon, minLat, maxLat } = geography.bounds
  return { ...station, lat, lon, x: 60 + ((lon - minLon) / (maxLon - minLon)) * 1120, y: 470 - ((lat - minLat) / (maxLat - minLat)) * 380 }
}

export const stationGeo = geography.stations
export const bounds = geography.bounds
