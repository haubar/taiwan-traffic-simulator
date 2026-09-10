import { createTRTCProvider } from '../providers/TRTCProvider'
import { createTYMCProvider } from '../providers/TYMCProvider'
import { createNTMCProvider } from '../providers/NTMCProvider'

export const createTransitProviders = (lines) => {
  return { trtc: createTRTCProvider(lines), tymc: createTYMCProvider(lines), ntmc: createNTMCProvider(lines) }
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
