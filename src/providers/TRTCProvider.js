import { ScheduledProvider } from './scheduledProvider'

/** Adapter boundary for the TRTC member API. The real endpoint/fields are intentionally not assumed. */
export class TRTCProvider {
  constructor(lines, env = import.meta.env) {
    this.lines = lines
    this.env = env
    this.fallback = new ScheduledProvider('TRTC', lines)
  }

  getSchedules() {
    return this.fallback.getSchedules()
  }

  get config() {
    return { baseUrl: this.env.VITE_TRTC_API_BASE || '', hasApiKey: Boolean(this.env.VITE_TRTC_API_KEY) }
  }
}
