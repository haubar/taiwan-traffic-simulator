import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const timetableSources = require('../data/trtcTimetableSources.json')
const lines = require('../../src/data/network.json')

const CSV_FIELDS = ['SEQNO', 'RouteID', 'StationID', 'StationName', 'Direction', 'DestinationStaionID', 'DestinationStationName', 'DepartureTimes', 'ServiceDays', 'UpdateTime', 'EffectiveDate']
const DAY_OFFSETS = [-1, 0, 1]
const DWELL_SECONDS = 20
const MATCH_TOLERANCE_SECONDS = 150
const AVERAGE_SPEED_KPH = 35
const MINIMUM_RUNTIME_SECONDS = 45

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
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60
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

const routeStations = (routeId, destination) => {
  const baseId = routeId.split('-')[0]
  const line = lines.find((item) => item.id === baseId)
  if (baseId !== 'O' || destination !== 'O54') return line?.stations ?? []
  const branch = lines.find((item) => item.id === 'OL')
  const stem = line.stations.slice(0, line.stations.findIndex((station) => station.id === 'O12') + 1)
  return [...stem, ...(branch?.stations.slice(1) ?? [])]
}

const distanceMeters = (a, b) => {
  const lat = ((a.lat + b.lat) / 2) * Math.PI / 180
  const dx = (b.lon - a.lon) * 111320 * Math.cos(lat)
  const dy = (b.lat - a.lat) * 110540
  return Math.sqrt(dx * dx + dy * dy)
}

const estimateRuntime = (from, to) => Math.max(MINIMUM_RUNTIME_SECONDS, Math.round(distanceMeters(from, to) / (AVERAGE_SPEED_KPH * 1000 / 3600)))

const matchDeparture = (source, candidates, used, expectedSec) => {
  let selected = null, smallestDifference = MATCH_TOLERANCE_SECONDS + 1
  for (const candidate of candidates) {
    if (used.has(candidate) || candidate.seconds <= source.seconds) continue
    const difference = Math.abs(candidate.seconds - expectedSec)
    if (difference < smallestDifference) { selected = candidate; smallestDifference = difference }
  }
  if (selected) used.add(selected)
  return selected
}

const getScheduleSources = () => {
  const day = parseServiceDay()
  return timetableSources.filter((source) => source.serviceDay === day)
}

export const fetchTRTCSchedules = async () => {
  const files = await Promise.all(getScheduleSources().map(async (source) => ({ source, rows: await downloadRows(source.resourceId) })))
  const schedules = []
  for (const { source, rows } of files) {
    const services = new Map()
    for (const row of rows) {
      const departure = parseDeparture(row.DepartureTimes)
      if (!Number.isFinite(departure)) continue
      const routeId = row.RouteID.split('-')[0]
      const key = `${routeId}|${row.Direction}|${row.DestinationStaionID}`
      const service = services.get(key) ?? { routeId, direction: Number(row.Direction), destination: row.DestinationStaionID, stations: new Map() }
      const stationDepartures = service.stations.get(row.StationID) ?? []
      stationDepartures.push({ seconds: departure, trainId: null })
      service.stations.set(row.StationID, stationDepartures)
      services.set(key, service)
    }

    for (const service of services.values()) {
      const stations = routeStations(service.routeId, service.destination)
      const destinationIndex = stations.findIndex((station) => station.id === service.destination)
      if (destinationIndex < 0) continue
      const step = service.direction === 0 ? 1 : -1
      const startIndex = step === 1 ? 0 : stations.length - 1
      const endIndex = destinationIndex
      if (Math.sign(endIndex - startIndex) !== step) continue

      for (let index = startIndex; index !== endIndex; index += step) {
        const from = stations[index], to = stations[index + step]
        const fromDepartures = service.stations.get(from.id) ?? []
        const toDepartures = service.stations.get(to.id) ?? []
        fromDepartures.sort((a, b) => a.seconds - b.seconds)
        toDepartures.sort((a, b) => a.seconds - b.seconds)
        const usedTargets = new Set()
        const routeLineId = from.id.startsWith('O5') || to.id.startsWith('O5') ? 'OL' : service.routeId
        const runtime = estimateRuntime(from, to)

        for (const departure of fromDepartures) {
          if (!departure.trainId) departure.trainId = `TRTC-${source.serviceDay}-${service.routeId}-${service.direction}-${service.destination}-${from.id}-${departure.seconds}`
          const expectedNextDeparture = departure.seconds + runtime + DWELL_SECONDS
          const nextDeparture = matchDeparture(departure, toDepartures, usedTargets, expectedNextDeparture)
          const arrival = nextDeparture ? Math.max(departure.seconds + 30, nextDeparture.seconds - DWELL_SECONDS) : departure.seconds + runtime
          const dwellUntil = nextDeparture?.seconds ?? arrival + DWELL_SECONDS

          for (const dayOffset of DAY_OFFSETS) {
            const shift = dayOffset * 86400
            schedules.push({
              id: `${departure.trainId}-${index}-${dayOffset}`,
              operator: 'TRTC', lineId: routeLineId, trainType: 'LOCAL', direction: step === 1 ? 0 : 1,
              fromStation: from.id, toStation: to.id,
              departureSec: departure.seconds + shift, arrivalSec: arrival + shift, dwellUntilSec: dwellUntil + shift,
              source: 'SCHEDULED', trainId: `${departure.trainId}-${dayOffset}`
            })
          }
          if (nextDeparture) nextDeparture.trainId = departure.trainId
        }
      }
    }
  }
  return schedules
}
