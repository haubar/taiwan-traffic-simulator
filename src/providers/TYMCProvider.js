import { ScheduledProvider } from './scheduledProvider'

export class TYMCProvider {
  constructor(lines) {
    this.lines = lines
    this.fallback = new ScheduledProvider('TYMC', lines)
    this.source = 'SCHEDULED'
  }

  getSchedules() {
    return this.fallback.getSchedules()
  }

  applyInterstationTimes(schedules, rows) {
    const byPair = new Map(rows.map((row) => [`${row.fromStation}->${row.toStation}->${row.vehicleType}`, row.seconds]))
    return schedules.map((schedule) => {
      const pair = `${schedule.fromStation}->${schedule.toStation}`
      const typed = rows.find((row) => `${row.fromStation}->${row.toStation}` === pair && (schedule.trainType === 'EXPRESS') === String(row.vehicleType).includes('直達'))
      const seconds = typed?.seconds || byPair.get(`${pair}->${schedule.trainType === 'EXPRESS' ? '直達車' : '普通車'}`)
      return seconds ? { ...schedule, arrivalSec: schedule.departureSec + seconds } : schedule
    })
  }

  async loadOfficialData(endpoint = '/.netlify/functions/trains?operator=TYMC') {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`TYMC provider ${response.status}`)
      const payload = await response.json()
      if (Array.isArray(payload.interstationTimes) && payload.interstationTimes.length) {
        this.source = 'SCHEDULED'
        return payload
      }
    } catch (error) {
      console.warn('[TYMCProvider] official data unavailable; using demo fallback', error)
    }
    return null
  }
}
