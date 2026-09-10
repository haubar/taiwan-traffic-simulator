import { TRTCProvider } from '../providers/TRTCProvider'
import { TYMCProvider } from '../providers/TYMCProvider'
import { NTMCProvider } from '../providers/NTMCProvider'

export function createTransitProviders(lines) {
  return { trtc: new TRTCProvider(lines), tymc: new TYMCProvider(lines), ntmc: new NTMCProvider(lines) }
}

export function getInitialSchedules(providers) {
  return [...providers.trtc.getSchedules(), ...providers.tymc.getSchedules(), ...providers.ntmc.getSchedules()]
}

export async function loadOfficialSchedules(providers, schedules) {
  const payload = await providers.tymc.loadOfficialData()
  if (!payload) return schedules
  return schedules.map((schedule) => schedule.operator === 'TYMC'
    ? providers.tymc.applyInterstationTimes([schedule], payload.interstationTimes)[0]
    : schedule)
}
