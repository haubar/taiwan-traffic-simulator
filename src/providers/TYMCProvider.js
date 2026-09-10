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

  return { getSchedules: () => allowDemo ? fallback.getSchedules() : [], applyInterstationTimes, loadOfficialData, get source() { return source } }
}
