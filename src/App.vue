<script setup>
import { computed, onMounted, ref } from 'vue'
import { lines } from './data/network'
import { useSimulation, formatSimulationTime } from './composables/useSimulation'
import { useTrainPosition } from './composables/useTrainPosition'
import { createTransitProviders, getInitialSchedules, loadOfficialSchedules } from './services/providerService'
import RailMap from './components/RailMap.vue'
import Timeline from './components/Timeline.vue'
import ThreeRailMap from './components/ThreeRailMap.vue'
import ScenarioScene from './components/ScenarioScene.vue'

const providers = createTransitProviders(lines)
const schedules=ref(getInitialSchedules(providers))
const {simSec,speed,playing,timeLabel,setNow}=useSimulation()
const {activeTrains}=useTrainPosition(lines,schedules,simSec)
const selected=ref(null)
const viewMode=ref('flat')
const journeyMode=ref('overview')
const visualStyle=ref('tech')
const scheduleRows = computed(() => activeTrains.value.slice().sort((a,b) => a.arrivalSec - b.arrivalSec).slice(0, 14))
const selectTrain = (train) => { selected.value=train; viewMode.value='scene' }
const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
onMounted(async () => { schedules.value = await loadOfficialSchedules(providers, schedules.value) })
</script>
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
  <section v-if="selected" class="detail">
    <strong>{{selected.trainId}}</strong><span>{{selected.operator}} · {{selected.lineId}} · {{selected.trainType==='EXPRESS'?'直達車':'普通車'}}</span>
    <span>{{selected.direction===0?'往終點':'往起點'}} · {{selected.fromName}} → {{selected.toName}}</span><span>{{selected.status==='DWELLING'?'停靠中':'行駛中'}} · 進度 {{Math.round(selected.progress*100)}}%</span>
    <span>預計抵達 {{formatSimulationTime(selected.arrivalSec)}}</span><span class="source" :class="selected.source.toLowerCase()">{{selected.source}}</span><small>更新 {{selected.updatedAt}}</small>
  </section>
  <section class="legend"><span>資料狀態：LIVE 即時 · ESTIMATED 推估 · SCHEDULED 官方時刻表</span><span>{{demoEnabled?'開發展示模式：含 DEMO fallback':'嚴格官方資料模式：未取得官方班次時不顯示列車'}}</span></section>
</main>
</template>
