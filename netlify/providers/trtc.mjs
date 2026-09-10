/**
 * TRTC member API boundary. The official endpoint and response fields are
 * intentionally supplied by configuration/mapping, never guessed here.
 */
export function createTRTCClient({ baseUrl = process.env.TRTC_API_BASE, apiKey = process.env.TRTC_API_KEY, fetcher = fetch } = {}) {
  return {
    enabled: Boolean(baseUrl && apiKey),
    async fetchRaw(path, options = {}) {
      if (!baseUrl || !apiKey) return null
      const response = await fetcher(new URL(path, baseUrl), { ...options, headers: { ...options.headers, Authorization: `Bearer ${apiKey}` } })
      if (!response.ok) throw new Error(`TRTC API ${response.status}`)
      return response.json()
    }
  }
}

export function mapTRTCTrainStates(payload, mapping) {
  if (!mapping || typeof mapping !== 'function') return []
  return (Array.isArray(payload) ? payload : []).map(mapping).filter(Boolean)
}
