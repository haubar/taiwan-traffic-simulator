import { createDemoSchedules } from '../data/demoSchedules'

export class ScheduledProvider {
  constructor(operator, lines) {
    this.operator = operator
    this.lines = lines
  }

  getSchedules() {
    return createDemoSchedules(this.lines).filter((schedule) => schedule.operator === this.operator)
  }
}
