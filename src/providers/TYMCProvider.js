import { createScheduledProvider } from './scheduledProvider'

export const createTYMCProvider = (lines, allowDemo = false) => {
  const fallback = createScheduledProvider('TYMC', lines)
  let source = 'SCHEDULED'
  const applyInterstationTimes = (schedules, rows) => {
    const byPair = new Map(rows.map((row) => [`${row.fromStation}->${row.toStation}->${row.vehicleType}`, row.seconds]))
    return schedules.map((schedule) => {
      const pair = `${schedule.fromStation}->${schedule.toStation}`
      const typed = rows.find((row) => `${row.fromStation}->${row.toStation}` === pair && (schedule.trainType === 'EXPRESS') === String(row.vehicleType).includes('直達'))
      const seconds = typed?.seconds || byPair.get(`${pair}->${schedule.trainType === 'EXPRESS' ? '直達車' : '普通車'}`)
      return seconds ? { ...schedule, arrivalSec: schedule.departureSec + seconds, dwellUntilSec: schedule.departureSec + seconds + 18 } : schedule
    })
  }

  const buildOfficialSchedules = (payload) => {
    const line = lines.find((item) => item.id === 'A')
    const departures = payload?.departures?.departures ?? []
    return departures.flatMap((departure, index) => {
      const fullSequence = departure.originStation === 'A1' ? line.stations : [...line.stations].reverse()
      const sequence = departure.trainType === 'EXPRESS' && departure.stops.length > 1
        ? departure.stops.map((id) => line.stations.find((station) => station.id === id)).filter(Boolean)
        : fullSequence
      return [-1, 0, 1].flatMap((dayOffset) => sequence.slice(0, -1).map((from, segmentIndex) => {
        const to = sequence[segmentIndex + 1]
        const runtime = payload.interstationTimes.find((row) => row.fromStation === from.id && row.toStation === to.id && ((departure.trainType === 'EXPRESS') === String(row.vehicleType).includes('直達')))?.seconds
        if (!runtime) return null
        const departureSec = departure.departureSec + dayOffset * 86400 + segmentIndex * runtime
        return { id: `TYMC-official-${dayOffset}-${index}-${segmentIndex}`, operator: 'TYMC', lineId: 'A', trainType: departure.trainType, direction: departure.originStation === 'A1' ? 0 : 1, fromStation: from.id, toStation: to.id, departureSec, arrivalSec: departureSec + runtime, dwellUntilSec: departureSec + runtime, source: 'SCHEDULED', trainId: `TYMC-${departure.originStation}-${String(index + 1).padStart(3, '0')}` }
      }).filter(Boolean))
    })
  }

  const loadOfficialData = async (endpoint = '/.netlify/functions/trains?operator=TYMC') => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(endpoint)
        if (!response.ok) throw new Error(`TYMC provider ${response.status}`)
        const payload = await response.json()
        if (Array.isArray(payload.interstationTimes) && payload.interstationTimes.every((row) => row.fromStation && row.toStation && Number.isFinite(row.seconds))) {
          source = 'SCHEDULED'
          return payload
        }
        throw new Error('TYMC provider schema validation failed')
      } catch (error) {
        if (attempt === 2) console.warn('[TYMCProvider] official data unavailable; strict mode keeps official schedule empty', error)
        else await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
      }
    }
    return null
  }

  return { getSchedules: () => allowDemo ? fallback.getSchedules() : [], buildOfficialSchedules, applyInterstationTimes, loadOfficialData, get source() { return source } }
}
