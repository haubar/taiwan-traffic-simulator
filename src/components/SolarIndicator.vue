<script setup>
defineProps({
  daylight: { type: Number, default: 1 },
  sunrise: { type: String, default: '--:--' },
  sunset: { type: String, default: '--:--' }
})
</script>

<template>
  <div class="solar-indicator" :class="{ night: daylight < 0.35 }" :aria-label="`日出 ${sunrise}，日落 ${sunset}`">
    <span class="solar-icon" aria-hidden="true">{{ daylight < 0.35 ? '☾' : '☀' }}</span>
    <span class="solar-times"><b>{{ daylight < 0.35 ? '夜間' : '日間' }}</b><small>日出 {{ sunrise }} · 日落 {{ sunset }}</small></span>
  </div>
</template>

<style scoped>
.solar-indicator { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #e5bb58; border-radius: 9px; padding: 5px 9px; background: #fff5d8e8; color: #705018; white-space: nowrap; }
.solar-indicator.night { border-color: #758db2; background: #15263ce8; color: #e2ebfa; }
.solar-icon { font-size: 22px; line-height: 1; }
.solar-times { display: flex; flex-direction: column; gap: 1px; }
.solar-times b { font-size: 11px; }
.solar-times small { font-size: 9px; opacity: .8; }
</style>
