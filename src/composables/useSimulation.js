import { computed, onBeforeUnmount, ref } from 'vue'

export function secOfDay(d=new Date()) { return d.getHours()*3600+d.getMinutes()*60+d.getSeconds() }
export function formatClock(sec){ const normalized=((Math.floor(sec)%86400)+86400)%86400; const h=Math.floor(normalized/3600),m=Math.floor(normalized%3600/60),s=normalized%60; return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':') }
export function formatSimulationTime(sec) { return `${Math.floor(sec / 86400) ? '+1日 ' : ''}${formatClock(sec)}` }

export function useSimulation(){
  const simSec=ref(secOfDay())
  const speed=ref(1)
  const playing=ref(true)
  let last=performance.now(), raf=0
  const tick=(now)=>{ if(playing.value) simSec.value+=((now-last)/1000)*speed.value; last=now; raf=requestAnimationFrame(tick) }
  raf=requestAnimationFrame(tick)
  onBeforeUnmount(()=>cancelAnimationFrame(raf))
  const timeLabel=computed(()=>formatClock(simSec.value))
  const setNow=()=>{simSec.value=secOfDay(); speed.value=1; playing.value=true}
  return {simSec,speed,playing,timeLabel,setNow}
}
