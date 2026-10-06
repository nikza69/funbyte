<script setup>
defineProps({ title: String, sub: String })
</script>
<template>
  <div class="rounded-xl bg-surface-container p-space-lg shadow-sm h-full">
    <div class="flex items-start justify-between gap-3 mb-space-sm">
      <div>
        <div class="font-headline-lg text-headline-lg text-on-surface">{{ title }}</div>
        <div v-if="sub" class="font-body-md text-body-md text-on-surface-variant">{{ sub }}</div>
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>
