export const TYMC_INTERSTATION_URL = 'https://opendata.tycg.gov.tw/api/dataset/89f0287e-90da-4e46-a0f4-3eefd4718025/resource/4b4ea6d2-84b6-4614-b67d-9fe50084fca3/download'

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
