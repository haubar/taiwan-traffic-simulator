import { ScheduledProvider } from './scheduledProvider'

/** 新北捷運官方即時資料尚未接入前，環狀線使用明確標示的時刻表 fallback。 */
export class NTMCProvider {
  constructor(lines) {
    this.fallback = new ScheduledProvider('NTMC', lines)
  }

  getSchedules() {
    return this.fallback.getSchedules()
  }
}
