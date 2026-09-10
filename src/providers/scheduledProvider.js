import { createDemoSchedules } from '../data/demoSchedules'

export const createScheduledProvider = (operator, lines) => ({
  getSchedules: () => createDemoSchedules(lines).filter((schedule) => schedule.operator === operator)
})
