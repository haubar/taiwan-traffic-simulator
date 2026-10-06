import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const timetableSources = require('../data/trtcTimetableSources.json')
const lines = require('../../src/data/network.json')

const CSV_FIELDS = ['SEQNO', 'RouteID', 'StationID', 'StationName', 'Direction', 'DestinationStaionID', 'DestinationStationName', 'DepartureTimes', 'ServiceDays', 'UpdateTime', 'EffectiveDate']
const DAY_OFFSETS = [-1, 0, 1]
const DWELL_SECONDS = 20

const parseCsv = (text) => {
  const rows = []
  let row = [], field = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const headers = rows.shift()?.map((value) => value.replace(/^\uFEFF/, '').trim()) ?? []
  if (!CSV_FIELDS.every((name) => headers.includes(name))) throw new Error('Unexpected TRTC timetable CSV columns')
  return rows.filter((values) => values.length === headers.length).map((values) => Object.fromEntries(headers.map((name, index) => [name, values[index]])))
}

const parseDeparture = (value) => {
  const match = value.match(/^\{\s*(\d+),.*?(\d{1,2}):(\d{2})/)
  if (!match) return null
  return { sequence: Number(match[1]), seconds: Number(match[2]) * 3600 + Number(match[3]) * 60 }
}

const parseServiceDay = () => {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', weekday: 'short' }).format(new Date())
  return weekday === 'Sat' ? 'saturday' : weekday === 'Sun' ? 'sunday' : 'weekday'
}

const downloadRows = async (resourceId) => {
  const url = `https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=${resourceId}`
  const response = await fetch(url, { headers: { accept: 'text/csv,*/*' } })
  if (!response.ok) throw new Error(`TRTC timetable ${response.status}`)
  const bytes = await response.arrayBuffer()
  let text
  try { text = new TextDecoder('big5').decode(bytes) }
  catch { text = new TextDecoder('utf-8').decode(bytes) }
  return parseCsv(text)
}

const routeStations = (routeId) => {
  const baseId = routeId.split('-')[0]
  const line = lines.find((item) => item.id === baseId)
  if (baseId !== 'O' || !routeId.endsWith('-2')) return line?.stations ?? []
  const branch = lines.find((item) => item.id === 'OL')
  const stem = line.stations.slice(0, line.stations.findIndex((station) => station.id === 'O12') + 1)
  return [...stem, ...(branch?.stations.slice(1) ?? [])]
}

const getScheduleSources = () => {
  const day = parseServiceDay()
  return timetableSources.filter((source) => source.serviceDay === day)
}

export const fetchTRTCSchedules = async () => {
  const files = await Promise.all(getScheduleSources().map(async (source) => ({ source, rows: await downloadRows(source.resourceId) })))
  const schedules = []
  for (const { source, rows } of files) {
    const trips = new Map()
    for (const row of rows) {
      const departure = parseDeparture(row.DepartureTimes)
      if (!departure) continue
      const tripKey = `${row.RouteID}|${row.Direction}|${row.DestinationStaionID}|${departure.sequence}`
      const trip = trips.get(tripKey) ?? { routeId: row.RouteID, direction: Number(row.Direction), destination: row.DestinationStaionID, departures: new Map() }
      trip.departures.set(row.StationID, departure.seconds)
      trips.set(tripKey, trip)
    }

    for (const [tripKey, trip] of trips) {
      const stations = routeStations(trip.routeId)
      const step = trip.direction === 0 ? 1 : -1
      const originIndex = stations.findIndex((station, index) => trip.departures.has(station.id) && !trip.departures.has(stations[index - step]?.id))
      const destinationIndex = stations.findIndex((station) => station.id === trip.destination)
      if (originIndex < 0 || destinationIndex < 0 || originIndex === destinationIndex || Math.sign(destinationIndex - originIndex) !== step) continue
      const routeLineId = trip.routeId.split('-')[0]
      for (let index = originIndex; index !== destinationIndex; index += step) {
        const from = stations[index], to = stations[index + step]
        const departureSec = trip.departures.get(from.id)
        const nextDepartureSec = trip.departures.get(to.id)
        if (!Number.isFinite(departureSec) || !Number.isFinite(nextDepartureSec) || nextDepartureSec <= departureSec) continue
        const lineId = routeLineId === 'O' && (from.id.startsWith('O5') || to.id.startsWith('O5')) ? 'OL' : routeLineId
        for (const dayOffset of DAY_OFFSETS) {
          const shiftedDeparture = departureSec + dayOffset * 86400
          const shiftedNextDeparture = nextDepartureSec + dayOffset * 86400
          schedules.push({
            id: `TRTC-${source.serviceDay}-${tripKey}-${index}-${dayOffset}`,
            operator: 'TRTC', lineId, trainType: 'LOCAL', direction: step === 1 ? 0 : 1,
            fromStation: from.id, toStation: to.id,
            departureSec: shiftedDeparture,
            arrivalSec: Math.max(shiftedDeparture + 30, shiftedNextDeparture - DWELL_SECONDS),
            dwellUntilSec: shiftedNextDeparture,
            source: 'SCHEDULED', trainId: `TRTC-${trip.routeId}-${trip.direction}-${tripKey.split('|').at(-1)}`
          })
        }
      }
    }
  }
  return schedules
}
