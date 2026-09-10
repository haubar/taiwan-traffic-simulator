const makeTrips = (lineId, operator, stations, start, headway, runtime, count, express=false, dayOffset=0) => {
  const trips=[]
  for(let n=0;n<count;n++){
    const t0=start+n*headway
    const dir=n%2
    const seq=dir?[...stations].reverse():stations
    for(let i=0;i<seq.length-1;i++){
      const depart=t0+i*runtime
      trips.push({id:`${operator}-${lineId}-${dayOffset}-${n}-${i}`,operator,lineId,trainType:express?'EXPRESS':'LOCAL',direction:dir,fromStation:seq[i],toStation:seq[i+1],departureSec:depart+dayOffset*86400,arrivalSec:depart+dayOffset*86400+runtime-18,dwellUntilSec:depart+dayOffset*86400+runtime,source:'DEMO',trainId:`${operator}-${lineId}-${dayOffset}-${String(n+1).padStart(3,'0')}`})
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
  for (const dayOffset of [-1, 0, 1]) schedules.push(
    ...makeTrips('BL','TRTC',bl,5*3600+50*60,240,125,115,false,dayOffset),
    ...makeTrips('A','TYMC',a,5*3600+30*60,600,165,48,false,dayOffset),
    ...makeTrips('A','TYMC',a.filter((_,i)=>[0,2,7,11,12,17,21].includes(i)),6*3600,900,330,32,true,dayOffset),
    ...makeTrips('Y','NTMC',y,6*3600,480,115,70,false,dayOffset),
    ...makeTrips('R','TRTC',r,5*3600+45*60,300,115,110,false,dayOffset),
    ...makeTrips('G','TRTC',g,5*3600+45*60,300,105,110,false,dayOffset),
    ...makeTrips('O','TRTC',o,5*3600+50*60,300,100,110,false,dayOffset),
    ...makeTrips('OL','TRTC',ol,6*3600,420,110,80,false,dayOffset),
    ...makeTrips('BR','TRTC',br,5*3600+50*60,240,90,135,false,dayOffset)
  )
  return schedules
}
