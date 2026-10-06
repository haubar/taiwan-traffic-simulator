import { computed } from 'vue'
import solarConfig from '../data/solarConfig.json' with { type: 'json' }

const radians = (degrees) => degrees * Math.PI / 180
const normalizeDegrees = (degrees) => ((degrees % 360) + 360) % 360
const normalizeHours = (hours) => ((hours % 24) + 24) % 24

const solarEventMinutes = (date, latitude, longitude, timezoneOffsetHours, sunrise) => {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)
  const longitudeHour = longitude / 15
  const approximateTime = dayOfYear + ((sunrise ? 6 : 18) - longitudeHour) / 24
  const meanAnomaly = 0.9856 * approximateTime - 3.289
  const trueLongitude = normalizeDegrees(meanAnomaly + 1.916 * Math.sin(radians(meanAnomaly)) + 0.02 * Math.sin(2 * radians(meanAnomaly)) + 282.634)
  let rightAscension = normalizeDegrees(Math.atan(0.91764 * Math.tan(radians(trueLongitude))) * 180 / Math.PI)
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90
  rightAscension /= 15
  const sinDeclination = 0.39782 * Math.sin(radians(trueLongitude))
  const cosDeclination = Math.cos(Math.asin(sinDeclination))
  const cosHourAngle = (Math.cos(radians(90.833)) - sinDeclination * Math.sin(radians(latitude))) / (cosDeclination * Math.cos(radians(latitude)))
  const hourAngle = sunrise ? 360 - Math.acos(cosHourAngle) * 180 / Math.PI : Math.acos(cosHourAngle) * 180 / Math.PI
  const localMeanTime = hourAngle / 15 + rightAscension - 0.06571 * approximateTime - 6.622
  const utcHours = normalizeHours(localMeanTime - longitudeHour)
  return Math.round(normalizeHours(utcHours + timezoneOffsetHours) * 60)
}

const formatMinutes = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const useSolarCycle = (simSec) => {
  const startDate = new Date()
  const solarTimes = computed(() => {
    const dayOffset = Math.floor(simSec.value / 86400)
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayOffset)
    return {
      sunriseMinutes: solarEventMinutes(date, solarConfig.latitude, solarConfig.longitude, solarConfig.timezoneOffsetHours, true),
      sunsetMinutes: solarEventMinutes(date, solarConfig.latitude, solarConfig.longitude, solarConfig.timezoneOffsetHours, false)
    }
  })
  const daylight = computed(() => {
    const minute = (((simSec.value % 86400) + 86400) % 86400) / 60
    const { sunriseMinutes, sunsetMinutes } = solarTimes.value
    const twilight = solarConfig.twilightMinutes
    if (minute < sunriseMinutes - twilight || minute >= sunsetMinutes + twilight) return 0
    if (minute < sunriseMinutes + twilight) return (minute - (sunriseMinutes - twilight)) / (twilight * 2)
    if (minute < sunsetMinutes - twilight) return 1
    return 1 - (minute - (sunsetMinutes - twilight)) / (twilight * 2)
  })
  return {
    daylight,
    sunrise: computed(() => formatMinutes(solarTimes.value.sunriseMinutes)),
    sunset: computed(() => formatMinutes(solarTimes.value.sunsetMinutes))
  }
}
