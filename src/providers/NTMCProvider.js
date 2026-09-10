import { createScheduledProvider } from './scheduledProvider'

/** 新北捷運官方即時資料尚未接入前，環狀線使用明確標示的時刻表 fallback。 */
export const createNTMCProvider = (lines) => {
  const fallback = createScheduledProvider('NTMC', lines)
  return { getSchedules: () => fallback.getSchedules() }
}
