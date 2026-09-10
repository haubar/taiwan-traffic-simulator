<script setup>
const props=defineProps({modelValue:Number})
const emit=defineEmits(['update:modelValue'])
</script>
<template><div class="timeline"><input type="range" min="18000" max="90000" step="1" :value="modelValue" @input="emit('update:modelValue',Number($event.target.value))"/><div class="ticks"><span>05:00</span><span>10:00</span><span>15:00</span><span>20:00</span><span>25:00</span></div></div></template>
