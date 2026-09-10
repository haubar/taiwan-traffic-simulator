function makeTrips(lineId, operator, stations, start, headway, runtime, count, express=false){
  const trips=[]
  for(let n=0;n<count;n++){
    const t0=start+n*headway
    const dir=n%2
    const seq=dir?[...stations].reverse():stations
    for(let i=0;i<seq.length-1;i++){
      const depart=t0+i*runtime
      trips.push({id:`${operator}-${lineId}-${n}-${i}`,operator,lineId,trainType:express?'EXPRESS':'LOCAL',direction:dir,fromStation:seq[i],toStation:seq[i+1],departureSec:depart,arrivalSec:depart+runtime-18,source:'SCHEDULED',trainId:`${operator}-${lineId}-${String(n+1).padStart(3,'0')}`})
    }
  }
  return trips
}
export function createDemoSchedules(lines){
  const bl=lines.find(l=>l.id==='BL').stations.map(s=>s.id)
  const a=lines.find(l=>l.id==='A').stations.map(s=>s.id)
  return [
    ...makeTrips('BL','TRTC',bl,5*3600+50*60,240,125,115),
    ...makeTrips('A','TYMC',a,5*3600+30*60,600,165,48),
    ...makeTrips('A','TYMC',a.filter((_,i)=>[0,2,7,11,12,17,21].includes(i)),6*3600,900,330,32,true)
  ]
}
