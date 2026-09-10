import { createScheduledProvider } from './scheduledProvider'

/** Adapter boundary for the TRTC member API. The real endpoint/fields are intentionally not assumed. */
export const createTRTCProvider = (lines, env = import.meta.env) => {
  const fallback = createScheduledProvider('TRTC', lines)
  return {
    getSchedules: () => fallback.getSchedules(),
    config: { baseUrl: env.VITE_TRTC_API_BASE || '', hasApiKey: Boolean(env.VITE_TRTC_API_KEY) }
  }
}
