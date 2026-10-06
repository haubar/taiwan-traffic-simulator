import { fetchTYMCDepartures, fetchTYMCInterstation } from '../providers/tymc.mjs'
import { fetchTRTCSchedules } from '../providers/trtc.mjs'
import { fetchOpenDataVipDepartures } from '../providers/opendataVip.mjs'

let cache = { expiresAt: 0, interstationTimes: [], departures: { departures: [] } }
let trtcCache = { expiresAt: 0, schedules: [] }

export default async (request) => {
  const operator = new URL(request.url).searchParams.get('operator')
  if (operator === 'OPENDATAVIP') {
    const station = new URL(request.url).searchParams.get('station') || '中山'
    try {
      const payload = await fetchOpenDataVipDepartures(station)
      return Response.json({ ok: true, ...payload }, { headers: { 'cache-control': 'public, max-age=10' } })
    } catch (error) {
      console.error('[trains] OpenData.vip fetch failed', error)
      return Response.json({ ok: false, source: 'ESTIMATED', departures: [], error: '第三方到站資料暫時無法取得' }, { status: 502 })
    }
  }
  if (operator === 'TRTC') {
    if (trtcCache.expiresAt < Date.now()) {
      try {
        const schedules = await fetchTRTCSchedules()
        if (!schedules.length) throw new Error('No Taipei Metro timetable rows found')
        trtcCache = { expiresAt: Date.now() + 60 * 60 * 1000, schedules }
      } catch (error) {
        console.error('[trains] TRTC timetable fetch failed', error)
        if (!trtcCache.schedules.length) return Response.json({ ok: false, source: 'SCHEDULED', schedules: [], error: '台北捷運官方時刻表暫時無法取得' }, { status: 502 })
        trtcCache.expiresAt = Date.now() + 5 * 60 * 1000
      }
    }
    return Response.json({ ok: true, mode: 'official-static', source: 'SCHEDULED', fetchedAt: new Date().toISOString(), schedules: trtcCache.schedules }, { headers: { 'cache-control': 'public, max-age=3600' } })
  }
  if (operator !== 'TYMC') return Response.json({ ok: true, mode: 'official-not-configured', source: 'SCHEDULED', interstationTimes: [], departures: { departures: [] } })
  if (cache.expiresAt < Date.now()) {
    try {
      const [interstationTimes, departures] = await Promise.all([fetchTYMCInterstation(), fetchTYMCDepartures()])
      cache = { expiresAt: Date.now() + 15 * 60 * 1000, interstationTimes, departures }
    } catch (error) {
      console.error('[trains] TYMC fetch failed', error)
      if (cache.interstationTimes.length && cache.departures.departures.length) return Response.json({ ok: true, mode: 'stale-cache', source: 'SCHEDULED', fetchedAt: new Date(cache.expiresAt - 15 * 60 * 1000).toISOString(), interstationTimes: cache.interstationTimes, departures: cache.departures }, { headers: { 'cache-control': 'public, max-age=60' } })
      return Response.json({ ok: false, source: 'SCHEDULED', interstationTimes: [], departures: { departures: [] }, error: '官方資料暫時無法取得' }, { status: 502 })
    }
  }
  return Response.json({ ok: true, mode: 'official-static', source: 'SCHEDULED', fetchedAt: new Date().toISOString(), interstationTimes: cache.interstationTimes, departures: cache.departures }, { headers: { 'cache-control': 'public, max-age=900' } })
}
