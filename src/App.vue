<script setup>
import { ref } from 'vue'
import { lines } from './data/network'
import { createDemoSchedules } from './data/demoSchedules'
import { useSimulation, formatClock } from './composables/useSimulation'
import { useTrainPosition } from './composables/useTrainPosition'
import RailMap from './components/RailMap.vue'
import Timeline from './components/Timeline.vue'

const schedules=createDemoSchedules(lines)
const {simSec,speed,playing,timeLabel,setNow}=useSimulation()
const {activeTrains}=useTrainPosition(lines,schedules,simSec)
const selected=ref(null)
</script>
<template>
<main class="app-shell">
  <header><div><p class="eyebrow">TAIWAN TRAFFIC DIGITAL TWIN</p><h1>台灣軌道交通模擬器</h1><p class="sub">MVP：台北捷運板南線 + 桃園機場捷運</p></div><div class="clock"><span class="live-dot"></span>{{timeLabel}}</div></header>
  <section class="toolbar">
    <button @click="setNow">現在</button><button @click="playing=!playing">{{playing?'暫停':'播放'}}</button>
    <button v-for="v in [1,5,20]" :key="v" :class="{active:speed===v}" @click="speed=v">{{v}}x</button>
    <span class="count">運行中 {{activeTrains.length}} 列</span>
  </section>
  <RailMap :lines="lines" :trains="activeTrains" :selected-train="selected" @select="selected=$event"/>
  <Timeline v-model="simSec"/>
  <section v-if="selected" class="detail">
    <strong>{{selected.trainId}}</strong><span>{{selected.operator}} · {{selected.lineId}} · {{selected.trainType==='EXPRESS'?'直達車':'普通車'}}</span>
    <span>{{selected.fromName}} → {{selected.toName}}</span><span>區間進度 {{Math.round(selected.progress*100)}}%</span>
    <span>預計抵達 {{formatClock(selected.arrivalSec)}}</span><span class="source">{{selected.source}}</span>
  </section>
  <section class="legend"><span>● Demo/Scheduled：目前使用內建班表模擬資料</span><span>下一步：接 TRTC 會員即時列車 API 與桃捷官方資料來源</span></section>
</main>
</template>
