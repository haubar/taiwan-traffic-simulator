import { createScheduledProvider } from './scheduledProvider.js'

export const createTRTCProvider = (lines, allowDemo = false) => {
  const fallback = createScheduledProvider('TRTC', lines)
  const loadOfficialData = async (endpoint = '/.netlify/functions/trains?operator=TRTC') => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`TRTC provider ${response.status}`)
      const payload = await response.json()
      if (!Array.isArray(payload.schedules) || !payload.schedules.every((row) => row.operator === 'TRTC' && row.fromStation && row.toStation && Number.isFinite(row.departureSec) && Number.isFinite(row.arrivalSec))) throw new Error('TRTC provider schema validation failed')
      return payload
    } catch (error) {
      console.warn('[TRTCProvider] official timetable unavailable', error)
      return null
    }
  }
  return {
    getSchedules: () => allowDemo ? fallback.getSchedules() : [],
    loadOfficialData,
    config: { source: 'data.taipei' }
  }
}
