<script setup>
const props=defineProps({modelValue:Number})
const emit=defineEmits(['update:modelValue'])
</script>
<template><div class="timeline"><label for="time-range">模擬時間（可跨午夜）</label><input id="time-range" type="range" min="0" max="172800" step="1" :value="modelValue" @input="emit('update:modelValue',Number($event.target.value))"/><div class="ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>+1 日</span></div></div></template>
