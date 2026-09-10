import sourceConfig from '../data/opendataVipSources.json' with { type: 'json' }

const decodeHtml = (value) => value.replaceAll('&amp;', '&').replaceAll('&#039;', "'").replaceAll('&quot;', '"').replaceAll('&nbsp;', ' ').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
const cleanText = (value) => decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
const toSeconds = (value) => {
  const match = value.match(/^(\d+):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export const fetchOpenDataVipDepartures = async (stationName) => {
  const url = `${sourceConfig.departurePage}${encodeURIComponent(stationName)}`
  const response = await fetch(url, { headers: { accept: 'text/html' } })
  if (!response.ok) throw new Error(`OpenData.vip ${response.status}`)
  const html = await response.text()
  const cards = [...html.matchAll(/<div class="singleItem">([\s\S]*?)<\/div>\s*<\/div>/g)]
  const departures = cards.map((card, index) => {
    const body = card[1]
    const station = body.match(/class="departStation"[^>]*>([\s\S]*?)<\/div>/)?.[1]
    const destination = body.match(/class="destinationStation"[^>]*>([\s\S]*?)<\/div>/)?.[1]
    const countdown = body.match(/class="countDown"[^>]*data-end="([01])"[^>]*data-start="([^"]*)"/)
    const countdownText = countdown?.[2] || ''
    return {
      id: `ODV-${stationName}-${index}`,
      stationName: cleanText(station || stationName),
      destination: cleanText(destination || ''),
      etaSeconds: toSeconds(countdownText),
      status: countdown?.[1] === '1' ? 'ARRIVING' : 'COUNTDOWN',
      source: 'ESTIMATED',
      sourceUrl: url
    }
  }).filter((item) => item.stationName && item.destination && (item.etaSeconds !== null || item.status === 'ARRIVING'))
  return { stationName, departures, source: 'ESTIMATED', sourceUrl: url, updatedAt: new Date().toISOString() }
}
