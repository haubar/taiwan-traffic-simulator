import { computed } from 'vue'
import { formatClock } from './useSimulation'
export function useTrainPosition(lines,schedules,simSec){
  const activeTrains=computed(()=>{
    const grouped=new Map()
    for(const seg of schedules.value ?? schedules){
      const dwellUntil = seg.dwellUntilSec ?? seg.arrivalSec
      if(simSec.value < seg.departureSec || simSec.value > dwellUntil) continue
      const key=seg.trainId
      const line=lines.find(l=>l.id===seg.lineId)
      const a=line?.stations.find(s=>s.id===seg.fromStation), b=line?.stations.find(s=>s.id===seg.toStation)
      if(!a||!b) continue
      const p=Math.max(0,Math.min(1,(Math.min(simSec.value, seg.arrivalSec)-seg.departureSec)/(seg.arrivalSec-seg.departureSec)))
      grouped.set(key,{...seg,progress:p,status:simSec.value>seg.arrivalSec?'DWELLING':'RUNNING',x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,fromName:a.name,toName:b.name,departureTime:formatClock(seg.departureSec),arrivalTime:formatClock(seg.arrivalSec),updatedAt:new Date().toISOString()})
    }
    return [...grouped.values()]
  })
  return {activeTrains}
}
