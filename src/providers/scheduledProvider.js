import { createDemoSchedules } from '../services/demoScheduleBuilder.js'

export const createScheduledProvider = (operator, lines) => ({
  getSchedules: () => createDemoSchedules(lines).filter((schedule) => schedule.operator === operator)
})
