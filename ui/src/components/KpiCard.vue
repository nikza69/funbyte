<script setup>
defineProps({ label: String, icon: String, iconColor: { type: String, default: 'text-primary' }, big: [String, Number], unit: String })
</script>
<template>
  <div class="rounded-xl bg-surface-container p-space-md shadow-sm flex flex-col justify-between">
    <div class="flex items-start justify-between mb-space-xs">
      <span class="font-label-xs-mono text-label-xs-mono uppercase tracking-wider text-outline">{{ label }}</span>
      <span class="material-symbols-outlined text-[20px]" :class="iconColor">{{ icon }}</span>
    </div>
    <div class="flex items-baseline gap-space-xs">
      <span class="font-metric-display text-metric-display text-on-surface">{{ big }}</span>
      <span class="font-headline-sm text-headline-sm text-outline">{{ unit }}</span>
    </div>
    <div class="mt-space-sm flex items-center justify-between gap-2">
      <span class="font-label-md text-label-md font-medium"><slot name="foot" /></span>
      <span class="font-label-xs-mono text-label-xs-mono text-outline text-right"><slot name="note" /></span>
    </div>
  </div>
</template>
