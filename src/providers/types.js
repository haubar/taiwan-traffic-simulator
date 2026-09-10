/**
 * @typedef {'TRTC'|'TYMC'|'NTMC'} Operator
 * @typedef {'LOCAL'|'EXPRESS'} TrainType
 * @typedef {'LIVE'|'ESTIMATED'|'SCHEDULED'} SourceType
 * @typedef {Object} TrainState
 * @property {string} id
 * @property {Operator} operator
 * @property {string} lineId
 * @property {TrainType} trainType
 * @property {0|1} direction
 * @property {string} fromStation
 * @property {string} toStation
 * @property {string} departureTime
 * @property {string} arrivalTime
 * @property {number} progress
 * @property {SourceType} source
 * @property {string} updatedAt
 * @property {number} departureSec
 * @property {number} arrivalSec
 * @property {'RUNNING'|'DWELLING'} status
 */

export const SOURCE_LABELS = {
  LIVE: 'LIVE 即時',
  ESTIMATED: 'ESTIMATED 推估',
  SCHEDULED: 'SCHEDULED 時刻表'
}
