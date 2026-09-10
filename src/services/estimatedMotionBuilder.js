import config from '../data/estimatedMotionConfig.json' with { type: 'json' }
import { secOfDay } from '../composables/useSimulation.js'

const normalize = (value) => value.replace(/站$/, '').replaceAll('／', '/').trim()
const distanceMeters = (a, b) => {
  const lat = ((a.lat + b.lat) / 2) * Math.PI / 180
  const dx = (b.lon - a.lon) * 111320 * Math.cos(lat)
  const dy = (b.lat - a.lat) * 110540
  return Math.sqrt(dx * dx + dy * dy)
}
const estimateRuntime = (from, to) => Math.max(config.minimumRuntimeSeconds, Math.round(distanceMeters(from, to) / (config.defaultSpeedKph * 1000 / 3600)))
const findDirection = (line, stationIndex, destination) => {
  const first = normalize(line.stations[0].name)
  const last = normalize(line.stations.at(-1).name)
  if (destination === first) return 1
  if (destination === last) return 0
  return stationIndex < (line.stations.length - 1) / 2 ? 0 : 1
}

export const buildEstimatedSchedules = (lines, observations) => {
  const now = secOfDay()
  return observations.flatMap((observation) => {
    const stationName = normalize(observation.stationName)
    const destination = normalize(observation.destination)
    const eta = observation.status === 'ARRIVING' ? 0 : observation.etaSeconds
    if (eta === null || eta === undefined) return []
    return lines.flatMap((line) => {
      const stationIndex = line.stations.findIndex((station) => normalize(station.name) === stationName)
      if (stationIndex < 0) return []
      const direction = findDirection(line, stationIndex, destination)
      const trainId = `EST-${line.id}-${observation.id.replace(/[^\w-]/g, '-')}`
      const segments = []
      let currentIndex = stationIndex
      let arrivalSec = now + eta
      for (let segmentIndex = 0; segmentIndex < 8; segmentIndex += 1) {
        const fromIndex = currentIndex - (direction === 0 ? 1 : -1)
        const from = line.stations[fromIndex]
        const to = line.stations[currentIndex]
        if (!from || !to) break
        const runtime = estimateRuntime(from, to)
        const departureSec = arrivalSec - runtime
        segments.push({
          id: `ODV-estimated-${observation.id}-${line.id}-${segmentIndex}`,
          trainId,
          operator: line.operator,
          lineId: line.id,
          trainType: 'LOCAL',
          direction,
          fromStation: from.id,
          toStation: to.id,
          departureSec,
          arrivalSec,
          dwellUntilSec: arrivalSec + config.dwellSeconds,
          source: 'ESTIMATED',
          updatedAt: observation.updatedAt,
          estimation: { method: 'station-countdown-backward-etl', speedKph: config.defaultSpeedKph, distanceMeters: Math.round(distanceMeters(from, to)), runtimeSeconds: runtime }
        })
        if (departureSec <= now) break
        currentIndex = fromIndex
        arrivalSec = departureSec - config.dwellSeconds
      }
      return segments
    })
  })
}
