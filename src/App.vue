<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { lines } from './services/networkLoader.js'
import { useSimulation, formatSimulationTime } from './composables/useSimulation'
import { useTrainPosition } from './composables/useTrainPosition'
import { createTransitProviders, getInitialSchedules, loadOfficialSchedules } from './services/providerService'
import { buildEstimatedSchedules } from './services/estimatedMotionBuilder.js'
import RailMap from './components/RailMap.vue'
import Timeline from './components/Timeline.vue'
import ThreeRailMap from './components/ThreeRailMap.vue'
import ScenarioScene from './components/ScenarioScene.vue'

const providers = createTransitProviders(lines)
const schedules=ref(getInitialSchedules(providers))
const estimatedSchedules=ref([])
const {simSec,speed,playing,timeLabel,setNow}=useSimulation()
const simulationSchedules = computed(() => [...schedules.value, ...estimatedSchedules.value])
const {activeTrains}=useTrainPosition(lines,simulationSchedules,simSec)
const selected=ref(null)
const viewMode=ref('flat')
const journeyMode=ref('overview')
const visualStyle=ref('tech')
const scheduleRows = computed(() => activeTrains.value.slice().sort((a,b) => a.arrivalSec - b.arrivalSec).slice(0, 14))
const stationDepartures = ref(null)
const selectedStation = ref('中山')
const selectedLineId = ref('ALL')
const stationCache = new Map()
const stationRequesting = ref(false)
const cacheClock = ref(Date.now())
const cacheTimer = ref(null)
const lineFilters = computed(() => [{ id: 'ALL', name: '全部路線', color: '#6f89a8' }, ...lines.map((line) => ({ id: line.id, name: line.name, color: line.color }))])
const stationOptions = computed(() => {
  const matchingLines = selectedLineId.value === 'ALL' ? lines : lines.filter((line) => line.id === selectedLineId.value)
  return [...new Set(matchingLines.flatMap((line) => line.stations.map((station) => station.name)))].sort((a, b) => a.localeCompare(b, 'zh-Hant'))
})
const cooldownRemaining = computed(() => {
  const cached = stationCache.get(selectedStation.value)
  return cached ? Math.max(0, Math.ceil((60000 - (cacheClock.value - cached.fetchedAt)) / 1000)) : 0
})
const selectTrain = (train) => { selected.value=train; viewMode.value='scene' }
const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
const buildStationSchedules = (payload, fetchedAt) => {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - fetchedAt) / 1000))
  return buildEstimatedSchedules(lines, payload.departures.map((departure) => ({ ...departure, status: departure.status === 'ARRIVING' || (departure.etaSeconds !== null && departure.etaSeconds <= elapsedSeconds) ? 'ARRIVING' : departure.status, etaSeconds: departure.etaSeconds === null ? null : Math.max(0, departure.etaSeconds - elapsedSeconds), updatedAt: payload.updatedAt })))
}
const loadStationDepartures = async (stationName) => {
  const cached = stationCache.get(stationName)
  if (cached && cacheClock.value - cached.fetchedAt < 60000) {
    stationDepartures.value = cached.payload
    estimatedSchedules.value = buildStationSchedules(cached.payload, cached.fetchedAt)
    return
  }
  stationDepartures.value = null
  stationRequesting.value = true
  try {
    const payload = await providers.opendataVip.loadDepartures(stationName)
    stationCache.set(stationName, { payload, fetchedAt: Date.now() })
    stationDepartures.value = payload
    estimatedSchedules.value = buildStationSchedules(payload, Date.now())
  } catch (error) { console.warn('[OpenDataVipProvider] unavailable', error) } finally { stationRequesting.value = false }
}
onMounted(async () => {
  cacheTimer.value = window.setInterval(() => { cacheClock.value = Date.now() }, 1000)
  schedules.value = await loadOfficialSchedules(providers, schedules.value)
  await loadStationDepartures(selectedStation.value)
})
watch(selectedStation, (stationName) => { loadStationDepartures(stationName) })
watch(selectedLineId, () => { if (!stationOptions.value.includes(selectedStation.value)) selectedStation.value = stationOptions.value[0] || '中山' })
onBeforeUnmount(() => { if (cacheTimer.value) window.clearInterval(cacheTimer.value) })
</script>
<style>
.station-picker{border:1px solid #243650;background:#0d1727;border-radius:10px;padding:12px;margin-bottom:12px}.picker-label{color:#8094aa;font-size:12px;margin:4px 0 8px}.picker-label span{color:#f0cb6d;margin-left:8px}.line-picker{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px}.line-filter,.station-choice{border:1px solid #31435e;background:#172338;color:#dbe7f5;border-radius:8px;padding:7px 10px;cursor:pointer;white-space:nowrap}.line-filter{border-left:4px solid var(--line-color)}.line-filter.active,.station-choice.active{border-color:#8bc5ff;background:#24466d}.station-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px;max-height:180px;overflow-y:auto}.station-choice{text-align:center;font-size:12px}.picker-status{color:#8094aa;font-size:12px;margin-top:10px}@media(max-width:760px){.station-picker-grid{grid-template-columns:repeat(3,1fr)}.line-picker{margin-right:-4px}}
</style>
<template>
<main class="app-shell">
  <header><div><p class="eyebrow">NORTHERN TAIWAN TRAFFIC DIGITAL TWIN</p><h1>台灣軌道交通模擬器</h1><p class="sub">北部捷運路網：北捷四主線 + 板南線 + 桃園機場捷運 + 新北環狀線</p></div><div class="clock"><span class="live-dot"></span>{{formatSimulationTime(simSec)}}</div></header>
  <section class="toolbar">
    <button @click="setNow">現在</button><button @click="playing=!playing">{{playing?'暫停':'播放'}}</button>
    <button v-for="v in [1,5,20]" :key="v" :class="{active:speed===v}" @click="speed=v">{{v}}x</button><button :class="{active:viewMode==='scene'}" @click="viewMode=viewMode==='scene'?'flat':'scene'">{{viewMode==='scene'?'平面圖':'情境行進'}}</button><button :class="{active:viewMode==='3d'}" @click="viewMode=viewMode==='3d'?'flat':'3d'">{{viewMode==='3d'?'平面圖':'3D 地圖'}}</button><template v-if="viewMode==='3d'"><button :class="{active:journeyMode==='overview'}" @click="journeyMode='overview'">總覽</button><button :class="{active:journeyMode==='follow'}" @click="journeyMode='follow'">跟車旅程</button><button :class="{active:journeyMode==='cab'}" @click="journeyMode='cab'">車內視角</button><button :class="{active:visualStyle==='cute'}" @click="visualStyle=visualStyle==='cute'?'tech':'cute'">{{visualStyle==='cute'?'科技風':'可愛風'}}</button></template>
    <span class="count">運行中 {{activeTrains.length}} 列</span>
  </section>
  <ThreeRailMap v-if="viewMode==='3d'" :key="`${journeyMode}-${visualStyle}`" :lines="lines" :trains="activeTrains" :selected-train="selected" :journey-mode="journeyMode" :visual-style="visualStyle" @select="selectTrain"/><ScenarioScene v-else-if="viewMode==='scene'" :lines="lines" :trains="activeTrains" :selected-train="selected" @select="selected=$event"/><RailMap v-else :lines="lines" :trains="activeTrains" :selected-train="selected" @select="selectTrain"/>
  <Timeline v-model="simSec"/>
  <section class="schedule-board"><div class="schedule-heading"><div><strong>目前行車表</strong><small>依目前模擬時間排序 · 點擊列車進入情境行進</small></div><span>{{ scheduleRows.length }} 筆運行資料</span></div><div class="schedule-table"><button v-for="train in scheduleRows" :key="train.id" class="schedule-row" :class="{selected:selected?.id===train.id}" @click="selectTrain(train)"><b>{{train.trainId}}</b><span>{{train.lineId}} · {{train.trainType==='EXPRESS'?'直達車':'普通車'}}</span><span>{{train.fromName}} → {{train.toName}}</span><span>抵達 {{formatSimulationTime(train.arrivalSec)}}</span><em :class="train.source.toLowerCase()">{{train.source}}</em></button><p v-if="!scheduleRows.length">目前時間沒有可顯示的運行班次，請拖曳時間軸。</p></div></section>
  <section class="schedule-board estimated-arrivals"><div class="schedule-heading"><div><strong>第三方車站到站觀測</strong><small>OpenData.vip · 車站倒數，不代表列車 GPS 位置</small></div><span class="estimated">ESTIMATED</span></div><div class="station-picker"><div class="picker-label">路線</div><div class="line-picker"><button v-for="line in lineFilters" :key="line.id" type="button" class="line-filter" :class="{active:selectedLineId===line.id}" :style="{'--line-color':line.color}" @click="selectedLineId=line.id">{{line.name}}</button></div><div class="picker-label">車站 <span>{{selectedStation}}</span></div><div class="station-picker-grid"><button v-for="station in stationOptions" :key="station" type="button" class="station-choice" :class="{active:selectedStation===station}" @click="selectedStation=station">{{station}}</button></div><div class="picker-status">{{stationRequesting?'正在更新資料…':cooldownRemaining?`已快取，${cooldownRemaining} 秒內不重新讀取`:'可更新'}} · 每個站點獨立快取 60 秒</div></div><div class="schedule-table"><div v-for="departure in stationDepartures?.departures || []" :key="departure.id" class="schedule-row arrival-row"><b>{{departure.stationName}}</b><span>往 {{departure.destination}}</span><span>{{departure.status==='ARRIVING'?'列車進站':`約 ${departure.etaSeconds} 秒`}}</span><em class="estimated">ESTIMATED</em></div><p v-if="stationDepartures && !stationDepartures.departures.length">目前查詢車站沒有可顯示的到站觀測。</p><p v-if="!stationDepartures">正在取得 {{selectedStation}} 站資料…</p></div></section>
  <section v-if="selected" class="detail">
    <strong>{{selected.trainId}}</strong><span>{{selected.operator}} · {{selected.lineId}} · {{selected.trainType==='EXPRESS'?'直達車':'普通車'}}</span>
    <span>{{selected.direction===0?'往終點':'往起點'}} · {{selected.fromName}} → {{selected.toName}}</span><span>{{selected.status==='DWELLING'?'停靠中':'行駛中'}} · 進度 {{Math.round(selected.progress*100)}}%</span>
    <span>預計抵達 {{formatSimulationTime(selected.arrivalSec)}}</span><span class="source" :class="selected.source.toLowerCase()">{{selected.source}}</span><small>更新 {{selected.updatedAt}}</small>
  </section>
  <section class="legend"><span>資料狀態：LIVE 即時 · ESTIMATED 推估 · SCHEDULED 官方時刻表</span><span>{{demoEnabled?'開發展示模式：含 DEMO fallback':'嚴格官方資料模式：未取得官方班次時不顯示列車'}}</span></section>
</main>
</template>
