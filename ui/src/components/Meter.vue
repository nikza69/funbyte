<script setup>
defineProps({ label: String, value: String, pct: Number, color: { type: String, default: 'bg-primary' } })
</script>
<template>
  <div class="mb-space-sm">
    <div class="flex justify-between font-body-md text-body-md text-on-surface-variant"><span>{{ label }}</span><b class="text-on-surface">{{ value }}</b></div>
    <div class="h-2 rounded bg-surface-container-high"><div class="h-2 rounded" :class="color" :style="{ width: Math.max(0, Math.min(100, pct || 0)) + '%' }"></div></div>
  </div>
</template>
