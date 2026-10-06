<script setup>
defineProps({ text: String, tone: { type: String, default: 'mute' } })
// Full class names (not built by string-joining) so Tailwind can find them.
const TONE = {
  ok: 'bg-secondary/15 text-secondary', warn: 'bg-tertiary/15 text-tertiary', bad: 'bg-error/15 text-error',
  mute: 'bg-surface-container-high text-on-surface-variant', pri: 'bg-primary/15 text-primary',
}
</script>
<template>
  <span class="inline-flex items-center px-2 py-0.5 rounded font-label-xs-mono text-label-xs-mono font-bold" :class="TONE[tone]">
    <slot>{{ text }}</slot>
  </span>
</template>
