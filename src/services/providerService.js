import { createTRTCProvider } from '../providers/TRTCProvider.js'
import { createTYMCProvider } from '../providers/TYMCProvider.js'
import { createNTMCProvider } from '../providers/NTMCProvider.js'
import { createOpenDataVipProvider } from '../providers/OpenDataVipProvider.js'

export const createTransitProviders = (lines) => {
  const allowDemo = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
  return { trtc: createTRTCProvider(lines, allowDemo), tymc: createTYMCProvider(lines, allowDemo), ntmc: createNTMCProvider(lines, allowDemo), opendataVip: createOpenDataVipProvider() }
}

export const getInitialSchedules = (providers) => {
  return [...providers.trtc.getSchedules(), ...providers.tymc.getSchedules(), ...providers.ntmc.getSchedules()]
}

export const loadOfficialSchedules = async (providers, schedules) => {
  const [trtcPayload, tymcPayload] = await Promise.all([
    providers.trtc.loadOfficialData(),
    providers.tymc.loadOfficialData()
  ])
  let loaded = schedules
  if (trtcPayload) loaded = [...loaded.filter((schedule) => schedule.operator !== 'TRTC'), ...trtcPayload.schedules]
  if (tymcPayload) loaded = [...loaded.filter((schedule) => schedule.operator !== 'TYMC'), ...providers.tymc.buildOfficialSchedules(tymcPayload)]
  return loaded
}
