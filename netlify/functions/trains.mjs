import { fetchTYMCDepartures, fetchTYMCInterstation } from '../providers/tymc.mjs'

let cache = { expiresAt: 0, interstationTimes: [], departures: { departures: [] } }

export default async (request) => {
  const operator = new URL(request.url).searchParams.get('operator')
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
