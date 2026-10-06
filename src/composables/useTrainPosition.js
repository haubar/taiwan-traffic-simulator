import { computed } from 'vue'
import { formatClock } from './useSimulation'
export const useTrainPosition = (lines,schedules,simSec) => {
  const activeTrains=computed(()=>{
    const grouped=new Map()
    for(const seg of schedules.value ?? schedules){
      const dwellUntil = seg.dwellUntilSec ?? seg.arrivalSec
      if(simSec.value < seg.departureSec || simSec.value > dwellUntil) continue
      const line=lines.find(l=>l.id===seg.lineId)
      const a=line?.stations.find(s=>s.id===seg.fromStation), b=line?.stations.find(s=>s.id===seg.toStation)
      if(!a||!b) continue
      const p=Math.max(0,Math.min(1,(Math.min(simSec.value, seg.arrivalSec)-seg.departureSec)/(seg.arrivalSec-seg.departureSec)))
      const candidate={...seg,progress:p,status:simSec.value>=seg.arrivalSec?'DWELLING':'RUNNING',x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,lat:a.lat+(b.lat-a.lat)*p,lon:a.lon+(b.lon-a.lon)*p,fromName:a.name,toName:b.name,departureTime:formatClock(seg.departureSec),arrivalTime:formatClock(seg.arrivalSec),updatedAt:new Date().toISOString()}
      const previous=grouped.get(seg.trainId)
      // Schedule feeds may include both a segment arriving at a station and
      // the next segment departing at the same second. Keep the moving segment
      // so iteration order cannot make the train jump to another position.
      if(!previous || (candidate.status==='RUNNING' && previous.status!=='RUNNING') || (candidate.status===previous.status && candidate.departureSec>previous.departureSec)) grouped.set(seg.trainId,candidate)
    }
    return [...grouped.values()]
  })
  return {activeTrains}
}
