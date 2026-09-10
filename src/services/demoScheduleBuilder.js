import config from '../data/demoScheduleConfig.json' with { type: 'json' }

const makeTrips = (lineId, operator, stations, start, headway, runtime, count, trainType, stoppingIndexes, dayOffset=0) => {
  const trips=[]
  for(let n=0;n<count;n++){
    const t0=start+n*headway
    const dir=n%2
    const seq=dir?[...stations].reverse():stations
    for(let i=0;i<seq.length-1;i++){
      const depart=t0+i*runtime
      trips.push({id:`${operator}-${lineId}-${dayOffset}-${n}-${i}`,operator,lineId,trainType,direction:dir,fromStation:seq[i],toStation:seq[i+1],departureSec:depart+dayOffset*86400,arrivalSec:depart+dayOffset*86400+runtime-18,dwellUntilSec:depart+dayOffset*86400+runtime,source:'DEMO',trainId:`${operator}-${lineId}-${dayOffset}-${String(n+1).padStart(3,'0')}`})
    }
  }
  return trips
}
export const createDemoSchedules = (lines) => {
  const bl=lines.find(l=>l.id==='BL').stations.map(s=>s.id)
  const a=lines.find(l=>l.id==='A').stations.map(s=>s.id)
  const y=lines.find(l=>l.id==='Y').stations.map(s=>s.id)
  const r=lines.find(l=>l.id==='R').stations.map(s=>s.id)
  const g=lines.find(l=>l.id==='G').stations.map(s=>s.id)
  const o=lines.find(l=>l.id==='O').stations.map(s=>s.id)
  const ol=lines.find(l=>l.id==='OL').stations.map(s=>s.id)
  const br=lines.find(l=>l.id==='BR').stations.map(s=>s.id)
  const schedules=[]
  for (const dayOffset of config.days) for (const route of config.routes) {
    const stationIds = { BL:bl, A:a, Y:y, R:r, G:g, O:o, OL:ol, BR:br }[route.lineId]
    const selectedStations = route.stoppingIndexes ? stationIds.filter((_, index) => route.stoppingIndexes.includes(index)) : stationIds
    schedules.push(...makeTrips(route.lineId, route.operator, selectedStations, route.start, route.headway, route.runtime, route.count, route.trainType, route.stoppingIndexes, dayOffset))
  }
  return schedules
}
