/**
 * Third-party station arrival adapter. These observations are not TrainState
 * records because the page exposes a station countdown, not train GPS or the
 * next physical station segment.
 */
export const createOpenDataVipProvider = () => {
  const loadDepartures = async (stationName = '中山') => {
    const response = await fetch(`/.netlify/functions/trains?operator=OPENDATAVIP&station=${encodeURIComponent(stationName)}`)
    if (!response.ok) throw new Error(`OpenDataVip provider ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.departures)) throw new Error('OpenDataVip schema validation failed')
    return payload
  }
  return { loadDepartures }
}
