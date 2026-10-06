import { onMounted, onUnmounted } from 'vue'

// Run fn now, then every `ms`; stop automatically when the page is left.
export function usePolling(fn, ms) {
  let timer
  onMounted(() => { fn(); timer = setInterval(fn, ms) })
  onUnmounted(() => clearInterval(timer))
}
