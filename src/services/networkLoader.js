import rawNetwork from '../data/network.json' with { type: 'json' }
import { applyGeography } from './geographyProjection.js'

export const lines = rawNetwork.map((line) => ({
  ...line,
  stations: line.stations.map((station) => applyGeography(station))
}))
