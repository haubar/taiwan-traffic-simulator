import { createTRTCProvider } from '../providers/TRTCProvider'
import { createTYMCProvider } from '../providers/TYMCProvider'
import { createNTMCProvider } from '../providers/NTMCProvider'

export const createTransitProviders = (lines) => {
  const allowDemo = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
  return { trtc: createTRTCProvider(lines, import.meta.env, allowDemo), tymc: createTYMCProvider(lines, allowDemo), ntmc: createNTMCProvider(lines, allowDemo) }
}

export const getInitialSchedules = (providers) => {
  return [...providers.trtc.getSchedules(), ...providers.tymc.getSchedules(), ...providers.ntmc.getSchedules()]
}

export const loadOfficialSchedules = async (providers, schedules) => {
  const payload = await providers.tymc.loadOfficialData()
  if (!payload) return schedules
  return schedules.map((schedule) => schedule.operator === 'TYMC'
    ? providers.tymc.applyInterstationTimes([schedule], payload.interstationTimes)[0]
    : schedule)
}
