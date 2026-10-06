<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

// A chart that redraws itself whenever labels/datasets change.
const props = defineProps({ type: { type: String, default: 'line' }, labels: Array, datasets: Array, legend: Boolean })
const canvas = ref(null)
let chart
const AX = { ticks: { color: '#869397', font: { size: 10 } }, grid: { color: 'rgba(134,147,151,.15)' } }

function draw() {
  chart?.destroy()
  chart = new Chart(canvas.value, {
    type: props.type,
    data: { labels: props.labels, datasets: props.datasets },
    options: {
      animation: false, maintainAspectRatio: false,
      plugins: { legend: props.legend ? { labels: { color: '#bcc9cd', boxWidth: 10, font: { size: 10 } } } : { display: false } },
      scales: { x: AX, y: AX },
    },
  })
}
onMounted(draw)
watch(() => [props.labels, props.datasets], draw, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>
<template><div class="h-full"><canvas ref="canvas"></canvas></div></template>
