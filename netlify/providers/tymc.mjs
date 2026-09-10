import sources from '../data/tymcSources.json' with { type: 'json' }

export const TYMC_INTERSTATION_URL = sources.interstation

const splitCsv = (line) => {
  return line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((value) => value.replace(/^\"|\"$/g, '').trim())
}

export const parseInterstationCsv = (csv) => {
  const rows = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(splitCsv)
  if (rows.length < 2) return []
  const headers = rows[0]
  const find = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)))
  const route = find('路線代碼', '路線')
  const type = find('車種')
  const serial = find('站間序號')
  const from = find('起站車站代號', '起站')
  const to = find('迄站車站代號', '迄站')
  const seconds = find('站間行駛時間', '運行時間')
  return rows.slice(1).map((row) => ({ routeCode: row[route], vehicleType: row[type], sequence: row[serial], fromStation: row[from], toStation: row[to], seconds: Number(row[seconds]) })).filter((row) => row.fromStation && row.toStation && Number.isFinite(row.seconds) && row.seconds > 0)
}

export const fetchTYMCInterstation = async () => {
  const response = await fetch(TYMC_INTERSTATION_URL)
  if (!response.ok) throw new Error(`TYMC open data ${response.status}`)
  return parseInterstationCsv(await response.text())
}

const stripMarkup = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
export const parseTYMCDepartures = (html, originStation) => {
  const departures = []
  const cells = [...html.matchAll(/<td[\s\S]*?<\/td>/gi)].map((match) => match[0])
  for (const cell of cells) {
    const text = stripMarkup(cell).replace(/\s+/g, ' ')
    const match = text.match(/(\d{1,2})點\s*(\d{1,2})/)
    if (!match) continue
    const hour = Number(match[1]); const minute = Number(match[2])
    if (hour > 23 || minute > 59) continue
    const description = text
    const trainType = description.includes('直達車') ? 'EXPRESS' : description.includes('普通車') ? 'LOCAL' : null
    if (!trainType) continue
    const stops = [...description.matchAll(/A\d{1,2}a?/g)].map((item) => item[0])
    departures.push({ originStation, departureSec: hour * 3600 + minute * 60, trainType, stops })
  }
  return [...new Map(departures.map((item) => [`${item.originStation}-${item.departureSec}-${item.trainType}-${item.stops.join(',')}`, item])).values()]
}

export const fetchTYMCDepartures = async () => {
  const departures = (await Promise.all(sources.timetables.map(async ({ originStation, url }) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`TYMC timetable ${response.status}`)
    return parseTYMCDepartures(await response.text(), originStation)
  }))).flat()
  if (!departures.length) throw new Error('TYMC timetable contains no departures')
  return { departures, fetchedAt: new Date().toISOString(), sources: sources.timetables.map((source) => source.url) }
}
