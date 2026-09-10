<script setup>
defineProps({ lines: Array, trains: Array, selectedTrain: Object })
const emit = defineEmits(['select'])
</script>

<template>
  <div class="map-wrap">
    <div class="map-caption"><span>數位分身地圖</span><small>車輛位置為依資料來源推算</small></div>
    <svg viewBox="0 0 1240 380" class="rail-svg" role="img" aria-label="台灣軌道交通數位分身地圖">
      <defs>
        <linearGradient id="map-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#142943"/><stop offset="1" stop-color="#0b1829"/></linearGradient>
        <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#7192b6" stroke-opacity=".08"/></pattern>
        <filter id="vehicle-shadow" x="-30%" y="-50%" width="160%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
      </defs>
      <rect width="1240" height="380" rx="14" fill="url(#map-bg)"/><rect width="1240" height="380" rx="14" fill="url(#map-grid)"/>
      <path d="M0 55 C210 20 270 92 470 56 S820 30 1240 72" class="map-road"/><path d="M0 222 C180 188 300 250 510 214 S910 180 1240 232" class="map-road secondary"/>
      <path d="M0 0 H1240 V45 C1040 82 885 18 660 52 S260 72 0 38Z" class="water-area"/>
      <g class="map-blocks" aria-hidden="true"><rect x="80" y="72" width="120" height="26" rx="5"/><rect x="245" y="168" width="90" height="22" rx="5"/><rect x="690" y="70" width="142" height="25" rx="5"/><rect x="970" y="165" width="110" height="24" rx="5"/><rect x="410" y="320" width="130" height="20" rx="5"/><rect x="840" y="315" width="170" height="22" rx="5"/></g>
      <g v-for="line in lines" :key="line.id">
        <text x="24" :y="line.stations[0].y-48" class="line-label">{{ line.name }}</text>
        <polyline :points="line.stations.map(s=>`${s.x},${s.y}`).join(' ')" fill="none" stroke="#06101d" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline :points="line.stations.map(s=>`${s.x},${s.y}`).join(' ')" fill="none" :stroke="line.color" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <g v-for="st in line.stations" :key="st.id"><circle :cx="st.x" :cy="st.y" r="8" fill="var(--panel)" :stroke="line.color" stroke-width="4"/><text :x="st.x" :y="st.y+26" text-anchor="middle" class="station-id">{{st.id}}</text><text :x="st.x" :y="st.y+42" text-anchor="middle" class="station-name">{{st.name}}</text></g>
      </g>
      <g v-for="t in trains" :key="t.id" class="train" :class="{ selected: selectedTrain?.id === t.id }" @click="emit('select',t)" @keydown.enter="emit('select',t)" tabindex="0" :aria-label="`${t.trainId}，下一站 ${t.toName}`" :transform="`translate(${t.x} ${t.y}) scale(${t.direction===1?-1:1} 1)`">
        <rect x="-19" y="-9" width="38" height="18" rx="7" class="vehicle-body" :class="t.trainType.toLowerCase()" :style="{ '--vehicle-color': lines.find(line => line.id === t.lineId)?.color }" filter="url(#vehicle-shadow)"/>
        <path d="M13 -9 L20 -5 L20 5 L13 9Z" class="vehicle-nose"/><rect x="-11" y="-5" width="7" height="5" rx="1" class="vehicle-window"/><rect x="-2" y="-5" width="7" height="5" rx="1" class="vehicle-window"/><rect x="7" y="-5" width="4" height="5" rx="1" class="vehicle-window"/><circle cx="-11" cy="9" r="2" class="vehicle-wheel"/><circle cx="10" cy="9" r="2" class="vehicle-wheel"/>
        <text x="0" y="-16" text-anchor="middle" class="train-label">{{t.trainType==='EXPRESS'?'直':'普'}}</text><title>{{ t.trainId }} · {{ t.trainType==='EXPRESS'?'直達車':'普通車' }} · 下一站 {{ t.toName }} · {{ Math.round(t.progress * 100) }}%</title>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.map-caption { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 5px 10px; color: #d7e5f5; font-weight: 700; }
.map-caption small { color: #7790ad; font-weight: 400; }
.map-road { fill: none; stroke: #8eb3d1; stroke-opacity: .12; stroke-width: 18; }
.map-road.secondary { stroke-width: 10; stroke-dasharray: 18 14; }
.water-area { fill: #1d5674; fill-opacity: .18; }
.map-blocks rect { fill: #93a9bc; fill-opacity: .07; stroke: #adc5d6; stroke-opacity: .08; }
.vehicle-body { fill: var(--vehicle-color); stroke: #f5fbff; stroke-width: 1.5; }
.vehicle-body.express { fill: #d69a35; }
.vehicle-nose { fill: #f7fbff; fill-opacity: .8; }
.vehicle-window { fill: #102238; stroke: #d7efff; stroke-opacity: .35; }
.vehicle-wheel { fill: #06101d; }
.train-label { fill: #f6fbff; font-size: 8px; font-weight: 800; pointer-events: none; }
.train:hover .vehicle-body, .train.selected .vehicle-body { stroke-width: 3; filter: url(#vehicle-shadow); }
.train:focus { outline: none; }
</style>
