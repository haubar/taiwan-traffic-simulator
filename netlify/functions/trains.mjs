import { fetchTYMCInterstation } from '../providers/tymc.mjs'

let cache = { expiresAt: 0, interstationTimes: [] }

export default async (request) => {
  const operator = new URL(request.url).searchParams.get('operator')
  if (operator !== 'TYMC') return Response.json({ ok: true, mode: 'fallback', source: 'SCHEDULED', interstationTimes: [] })
  if (cache.expiresAt < Date.now()) {
    try {
      cache = { expiresAt: Date.now() + 15 * 60 * 1000, interstationTimes: await fetchTYMCInterstation() }
    } catch (error) {
      console.error('[trains] TYMC fetch failed', error)
      return Response.json({ ok: false, source: 'SCHEDULED', interstationTimes: [], error: '官方資料暫時無法取得' }, { status: 502 })
    }
  }
  return Response.json({ ok: true, mode: 'official-static', source: 'SCHEDULED', fetchedAt: new Date().toISOString(), interstationTimes: cache.interstationTimes }, { headers: { 'cache-control': 'public, max-age=900' } })
}
