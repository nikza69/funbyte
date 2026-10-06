import { reactive } from 'vue'
import { api } from './api'

// Shared live state (sensors, device state, health, thresholds). Every page reads this.
export const live = reactive({ data: null })
export async function pollLive() {
  const d = await api('/api/live')
  if (!d.error) live.data = d
}
