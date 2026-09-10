/**
 * TRTC member API boundary. The official endpoint and response fields are
 * intentionally supplied by configuration/mapping, never guessed here.
 */
export const createTRTCClient = ({
  baseUrl = process.env.TRTC_API_BASE,
  apiKey = process.env.TRTC_API_KEY,
  fetcher = fetch,
  requestHeaders
} = {}) => {
  const fetchRaw = async (path, options = {}) => {
    if (!baseUrl || !apiKey || typeof requestHeaders !== 'function') return null

    const headers = requestHeaders({ apiKey, options })
    const response = await fetcher(new URL(path, baseUrl), { ...options, headers })
    if (!response.ok) throw new Error(`TRTC API ${response.status}`)
    return response.json()
  }

  return {
    enabled: Boolean(baseUrl && apiKey && typeof requestHeaders === 'function'),
    fetchRaw
  }
}

export const mapTRTCTrainStates = (payload, mapping) => {
  if (!mapping || typeof mapping !== 'function') return []
  return (Array.isArray(payload) ? payload : []).map(mapping).filter(Boolean)
}
