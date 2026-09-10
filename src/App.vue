<script setup>
import { onMounted, ref } from 'vue'
import { lines } from './data/network'
import { useSimulation, formatSimulationTime } from './composables/useSimulation'
import { useTrainPosition } from './composables/useTrainPosition'
import { createTransitProviders, getInitialSchedules, loadOfficialSchedules } from './services/providerService'
import RailMap from './components/RailMap.vue'
import Timeline from './components/Timeline.vue'
import ThreeRailMap from './components/ThreeRailMap.vue'

const providers = createTransitProviders(lines)
const schedules=ref(getInitialSchedules(providers))
const {simSec,speed,playing,timeLabel,setNow}=useSimulation()
const {activeTrains}=useTrainPosition(lines,schedules,simSec)
const selected=ref(null)
const viewMode=ref('flat')
onMounted(async () => { schedules.value = await loadOfficialSchedules(providers, schedules.value) })
</script>
<template>
<main class="app-shell">
  <header><div><p class="eyebrow">NORTHERN TAIWAN TRAFFIC DIGITAL TWIN</p><h1>台灣軌道交通模擬器</h1><p class="sub">北部路網：板南線 + 桃園機場捷運 + 新北環狀線</p></div><div class="clock"><span class="live-dot"></span>{{formatSimulationTime(simSec)}}</div></header>
  <section class="toolbar">
    <button @click="setNow">現在</button><button @click="playing=!playing">{{playing?'暫停':'播放'}}</button>
    <button v-for="v in [1,5,20]" :key="v" :class="{active:speed===v}" @click="speed=v">{{v}}x</button><button :class="{active:viewMode==='3d'}" @click="viewMode=viewMode==='3d'?'flat':'3d'">{{viewMode==='3d'?'平面圖':'3D 地圖'}}</button>
    <span class="count">運行中 {{activeTrains.length}} 列</span>
  </section>
  <ThreeRailMap v-if="viewMode==='3d'" :lines="lines" :trains="activeTrains" :selected-train="selected" @select="selected=$event"/><RailMap v-else :lines="lines" :trains="activeTrains" :selected-train="selected" @select="selected=$event"/>
  <Timeline v-model="simSec"/>
  <section v-if="selected" class="detail">
    <strong>{{selected.trainId}}</strong><span>{{selected.operator}} · {{selected.lineId}} · {{selected.trainType==='EXPRESS'?'直達車':'普通車'}}</span>
    <span>{{selected.direction===0?'往終點':'往起點'}} · {{selected.fromName}} → {{selected.toName}}</span><span>區間進度 {{Math.round(selected.progress*100)}}%</span>
    <span>預計抵達 {{formatSimulationTime(selected.arrivalSec)}}</span><span class="source" :class="selected.source.toLowerCase()">{{selected.source}}</span><small>更新 {{selected.updatedAt}}</small>
  </section>
  <section class="legend"><span>資料狀態：LIVE 即時 · ESTIMATED 推估 · SCHEDULED 時刻表</span><span>目前為 SCHEDULED fallback；不代表 GPS 即時位置</span></section>
</main>
</template>
