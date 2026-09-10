<script setup>
defineProps({lines:Array,trains:Array,selectedTrain:Object})
const emit=defineEmits(['select'])
</script>
<template>
  <div class="map-wrap">
    <svg viewBox="0 0 1240 380" class="rail-svg" role="img" aria-label="台灣軌道交通模擬圖">
      <g v-for="line in lines" :key="line.id">
        <text x="24" :y="line.stations[0].y-48" class="line-label">{{ line.name }}</text>
        <polyline :points="line.stations.map(s=>`${s.x},${s.y}`).join(' ')" fill="none" :stroke="line.color" stroke-width="8" stroke-linecap="round"/>
        <g v-for="st in line.stations" :key="st.id">
          <circle :cx="st.x" :cy="st.y" r="7" fill="var(--panel)" :stroke="line.color" stroke-width="4"/>
          <text :x="st.x" :y="st.y+26" text-anchor="middle" class="station-id">{{st.id}}</text>
          <text :x="st.x" :y="st.y+42" text-anchor="middle" class="station-name">{{st.name}}</text>
        </g>
      </g>
      <g v-for="t in trains" :key="t.id" class="train" @click="emit('select',t)" @keydown.enter="emit('select',t)" tabindex="0" :aria-label="`${t.trainId}，下一站 ${t.toName}`">
        <circle :cx="t.x" :cy="t.y" :r="selectedTrain?.id===t.id?13:10" class="train-dot" :style="{stroke: lines.find(line => line.id === t.lineId)?.color}"/>
        <text :x="t.x" :y="t.y-17" text-anchor="middle" class="train-label">{{t.trainType==='EXPRESS'?'🚄':'🚇'}}</text>
        <title>{{ t.trainId }} · 下一站 {{ t.toName }} · {{ Math.round(t.progress * 100) }}%</title>
      </g>
    </svg>
  </div>
</template>
