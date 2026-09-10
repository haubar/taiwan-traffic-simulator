import { computed } from 'vue'
export function useTrainPosition(lines,schedules,simSec){
  const activeTrains=computed(()=>{
    const grouped=new Map()
    for(const seg of schedules){
      if(simSec.value < seg.departureSec || simSec.value > seg.arrivalSec) continue
      const key=seg.trainId
      const line=lines.find(l=>l.id===seg.lineId)
      const a=line?.stations.find(s=>s.id===seg.fromStation), b=line?.stations.find(s=>s.id===seg.toStation)
      if(!a||!b) continue
      const p=Math.max(0,Math.min(1,(simSec.value-seg.departureSec)/(seg.arrivalSec-seg.departureSec)))
      grouped.set(key,{...seg,progress:p,x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,fromName:a.name,toName:b.name})
    }
    return [...grouped.values()]
  })
  return {activeTrains}
}
