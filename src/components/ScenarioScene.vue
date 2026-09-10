<script setup>
import { computed } from 'vue'

const props = defineProps({ lines: Array, trains: Array, selectedTrain: Object })
const emit = defineEmits(['select'])

const focusTrain = computed(() => props.selectedTrain ?? props.trains[0] ?? null)
const focusLine = computed(() => props.lines.find((line) => line.id === focusTrain.value?.lineId) ?? props.lines[0])
const isAirport = computed(() => focusTrain.value?.operator === 'TYMC')
const isMountain = computed(() => ['R', 'G', 'BR'].includes(focusTrain.value?.lineId))
const isElevated = computed(() => ['BR', 'A', 'Y'].includes(focusTrain.value?.lineId))
const sceneTitle = computed(() => isAirport.value ? '桃園機場沿線情境' : `${focusLine.value?.name ?? '北部捷運'}沿線情境`)
const sceneDescription = computed(() => isAirport.value ? '機場聯外、高架軌道與桃園城市景觀' : isMountain.value ? '台北盆地、山勢與市區軌道景觀' : '台北都會區街廓與軌道景觀')
const trainX = (train) => 110 + train.progress * 980
const trainY = (train) => train === focusTrain.value ? 378 : 394 + (train.direction ? 15 : -15)
const trainRotation = (train) => train.direction === 0 ? 0 : 180
const stationAt = (train) => train?.status === 'DWELLING' ? train.fromName : train?.toName
const nearbyStations = computed(() => {
  const line = focusLine.value
  if (!line || !focusTrain.value) return []
  const index = line.stations.findIndex((station) => station.id === focusTrain.value.toStation)
  return line.stations.slice(Math.max(0, index - 2), index + 3)
})
const stationX = (station) => {
  const line = focusLine.value
  const index = line?.stations.findIndex((item) => item.id === station.id) ?? 0
  return 110 + (index / Math.max(1, line.stations.length - 1)) * 980
}
</script>

<template>
  <section class="scenario-wrap">
    <div class="scenario-caption"><div><strong>{{ sceneTitle }}</strong><small>{{ sceneDescription }}</small></div><span>實景行進模擬 · {{ focusTrain ? `${focusTrain.lat.toFixed(4)}, ${focusTrain.lon.toFixed(4)}` : '等待列車' }}</span></div>
    <div class="scenario-stage">
      <svg viewBox="0 0 1200 560" class="scenario-svg" role="img" :aria-label="`${sceneTitle}，列車行進情境`">
        <defs>
          <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#7cc9ed"/><stop offset="1" stop-color="#e8f2d0"/></linearGradient>
          <linearGradient id="scene-ground" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#91bd82"/><stop offset="1" stop-color="#476b50"/></linearGradient>
          <linearGradient id="scene-track" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#526473"/><stop offset="1" stop-color="#202c38"/></linearGradient>
          <filter id="scene-shadow"><feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#192633" flood-opacity=".45"/></filter>
        </defs>
        <rect width="1200" height="560" fill="url(#scene-sky)"/>
        <circle cx="1010" cy="92" r="46" fill="#fff7c2" opacity=".9"/>
        <path v-if="isMountain" d="M0 270 L130 126 L230 246 L382 95 L530 266 L690 130 L840 258 L1015 105 L1200 250 V350 H0Z" fill="#668b82" opacity=".75"/>
        <path v-else d="M0 285 L120 190 L250 260 L390 155 L535 270 L680 183 L820 272 L965 170 L1200 260 V350 H0Z" fill="#8ba8a0" opacity=".75"/>
        <path d="M0 315 C250 270 360 330 580 300 S940 277 1200 320 V560 H0Z" fill="url(#scene-ground)"/>
        <g class="scene-city" :class="{ airport: isAirport }">
          <rect v-for="n in 18" :key="n" :x="n * 72 - 35" :y="220 + (n * 37) % 76" :width="38 + (n * 13) % 35" :height="125 - (n * 21) % 70" rx="3"/>
          <rect v-if="isAirport" x="760" y="245" width="260" height="32" rx="10" class="terminal"/><path v-if="isAirport" d="M820 245 L850 205 H965 L995 245Z" class="terminal-roof"/>
        </g>
        <path d="M0 455 Q300 424 610 462 T1200 447" fill="none" stroke="#d9e4e7" stroke-width="74" opacity=".8"/>
        <path d="M0 455 Q300 424 610 462 T1200 447" fill="none" stroke="#71828a" stroke-width="52"/>
        <path d="M0 455 Q300 424 610 462 T1200 447" fill="none" stroke="#f6dc79" stroke-width="4" stroke-dasharray="38 26"/>
        <g class="rail-structure" :class="{ elevated: isElevated }"><path d="M0 382 H1200" stroke="url(#scene-track)" stroke-width="34"/><path d="M0 370 H1200 M0 394 H1200" stroke="#dce4e6" stroke-width="5"/><path d="M0 350 H1200" stroke="#303c47" stroke-width="9" stroke-dasharray="4 28"/></g>
        <g v-for="station in nearbyStations" :key="station.id" class="scene-station" :transform="`translate(${stationX(station)} 0)`"><rect x="-42" y="330" width="84" height="27" rx="5"/><text y="348" text-anchor="middle">{{ station.id }}</text><text y="314" text-anchor="middle" class="scene-station-name">{{ station.name }}</text></g>
        <g v-for="train in trains.slice(0, 12)" :key="train.id" class="scene-train" :class="{ selected: selectedTrain?.id === train.id, focus: focusTrain?.id === train.id }" :transform="`translate(${trainX(train)} ${trainY(train)}) rotate(${trainRotation(train)})`" @click="emit('select', train)">
          <ellipse cx="0" cy="19" rx="52" ry="9" fill="#1b2b35" opacity=".34"/>
          <g filter="url(#scene-shadow)"><rect x="-48" y="-23" width="96" height="43" rx="14" class="scene-vehicle" :style="{ '--vehicle-color': props.lines.find((line) => line.id === train.lineId)?.color }"/><path d="M35 -23 L51 -10 V7 L35 20Z" fill="#f9fbf0" opacity=".8"/><rect x="-32" y="-13" width="17" height="11" rx="3" class="scene-window"/><rect x="-9" y="-13" width="17" height="11" rx="3" class="scene-window"/><rect x="14" y="-13" width="13" height="11" rx="3" class="scene-window"/><circle cx="-29" cy="20" r="5" class="scene-wheel"/><circle cx="29" cy="20" r="5" class="scene-wheel"/></g>
          <text x="0" y="-34" text-anchor="middle" class="scene-train-label">{{ train.trainId }} · {{ train.trainType === 'EXPRESS' ? '直達' : '普通' }}</text>
          <title>{{ train.trainId }}，{{ train.fromName }} 前往 {{ train.toName }}</title>
        </g>
        <g class="scene-foreground"><path d="M0 525 Q150 480 300 525 T600 520 T900 525 T1200 518" fill="none" stroke="#31563e" stroke-width="30"/><path d="M0 530 Q150 485 300 530 T600 525 T900 530 T1200 523" fill="none" stroke="#9bc56e" stroke-width="4"/></g>
      </svg>
      <div class="scene-status" v-if="focusTrain"><b>{{ focusTrain.trainId }}</b><span>{{ focusTrain.status === 'DWELLING' ? '停靠中' : '行進中' }} · {{ focusTrain.fromName }} → {{ focusTrain.toName }}</span><strong>{{ Math.round(focusTrain.progress * 100) }}%</strong></div>
      <div class="scene-hint">點擊列車切換觀察目標 · 列車沿實際車站地理順序模擬行進</div>
    </div>
    <div class="scene-foot"><span>目前場景位置：{{ stationAt(focusTrain) ?? '—' }}</span><span>路線：{{ focusLine?.name ?? '—' }} · 資料：{{ focusTrain?.source ?? 'SCHEDULED' }}</span></div>
  </section>
</template>

<style scoped>
.scenario-wrap{background:#dbe7df;border:1px solid #496b6b;border-radius:18px;padding:10px;overflow:hidden}.scenario-caption{display:flex;justify-content:space-between;gap:16px;align-items:end;padding:3px 5px 10px;color:#183c45}.scenario-caption strong{display:block;font-size:18px}.scenario-caption small{display:block;color:#5d7779;margin-top:3px}.scenario-caption>span{font:12px ui-monospace,monospace;color:#577073}.scenario-stage{position:relative;overflow:hidden;border-radius:13px;background:#8fc8df}.scenario-svg{display:block;width:100%;min-height:430px}.scene-city rect{fill:#617d8c;opacity:.8}.scene-city rect:nth-child(3n){fill:#b5a27f}.scene-city .terminal{fill:#d4e2e5;opacity:1}.scene-city .terminal-roof{fill:#d4e2e5}.rail-structure.elevated{transform:translateY(-25px)}.rail-structure.elevated+g{}.scene-station rect{fill:#f7f4db;stroke:#294a52;stroke-width:3}.scene-station text{font-size:12px;fill:#173942;font-weight:800}.scene-station-name{font-size:13px!important;fill:#fff!important;paint-order:stroke;stroke:#31545a;stroke-width:5px}.scene-vehicle{fill:var(--vehicle-color);stroke:#fff;stroke-width:3}.scene-window{fill:#24475a;stroke:#dff2ed;stroke-width:2}.scene-wheel{fill:#1e2c33}.scene-train{cursor:pointer;transition:transform .14s linear}.scene-train-label{fill:#18333b;font-size:12px;font-weight:900;paint-order:stroke;stroke:#f5f7e9;stroke-width:4px}.scene-train.focus .scene-vehicle,.scene-train:hover .scene-vehicle{stroke:#ffe06a;stroke-width:5}.scene-train.selected .scene-vehicle{stroke:#ff7c4d;stroke-width:6}.scene-status{position:absolute;left:18px;bottom:17px;display:flex;gap:10px;align-items:center;background:#102d37e8;color:#eaf6e8;border-radius:10px;padding:9px 12px;font-size:13px}.scene-status b{color:#ffdb70}.scene-status strong{color:#8de0a6}.scene-hint{position:absolute;right:12px;bottom:12px;background:#f6fae7dd;color:#32565b;padding:7px 9px;border-radius:8px;font-size:12px}.scene-foot{display:flex;justify-content:space-between;gap:10px;color:#48676a;font-size:12px;padding:9px 4px 1px}@media(max-width:700px){.scenario-caption{align-items:flex-start;flex-direction:column}.scenario-caption>span{font-size:10px}.scene-hint{display:none}.scene-status{left:10px;right:10px;justify-content:space-between}.scene-foot{flex-direction:column}}
</style>
