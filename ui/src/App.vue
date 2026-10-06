<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { live, pollLive } from './store'
import { TZ } from './format'

const clock = ref('')
let t1, t2
onMounted(() => {
  pollLive(); t2 = setInterval(pollLive, 2000)                       // live data for every page
  const tick = () => (clock.value = new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }))
  tick(); t1 = setInterval(tick, 1000)
})
onUnmounted(() => { clearInterval(t1); clearInterval(t2) })

const L = computed(() => live.data)
const down = computed(() => (L.value ? ['mqtt', 'pg', 'influx', 'sim'].filter((k) => !L.value.health[k]) : []))
const feed = computed(() => (L.value && L.value.ageSec != null && L.value.ageSec < 30 ? `Live (${L.value.ageSec}s)` : 'No data'))

const NAV = [
  { to: '/main', icon: 'grid_view', title: 'Main', sub: 'Executive Overview' },
  { to: '/data-analytics', icon: 'monitoring', title: 'Data Analytics', sub: 'Energy & Cost Audit' },
  { to: '/system-analytics', icon: 'tune', title: 'System Analytics', sub: 'Telemetry & Controls' },
]
</script>

<template>
  <div class="bg-surface-container-lowest font-body-md text-on-surface antialiased min-h-screen">
    <aside class="fixed left-0 top-0 h-full w-64 bg-surface-container-low z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.24)]">
      <div class="flex flex-col">
        <div class="h-16 px-space-md flex items-center gap-space-sm bg-surface-container">
          <div class="h-8 w-8 rounded-md bg-orange-500 flex items-center justify-center font-bold text-white">T</div>
          <div class="flex flex-col min-w-0">
            <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight">Tanand</span>
            <span class="font-label-xs-mono text-label-xs-mono uppercase tracking-wider text-outline">Telemetry Hub</span>
          </div>
        </div>
        <div class="px-space-md py-space-sm"><span class="font-label-xs-mono text-label-xs-mono uppercase tracking-widest text-outline">Consoles</span></div>
        <nav class="flex flex-col gap-space-xs px-space-sm">
          <router-link v-for="i in NAV" :key="i.to" :to="i.to"
            class="flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            active-class="!bg-primary-container !text-on-primary-container font-bold">
            <span class="material-symbols-outlined text-[20px]">{{ i.icon }}</span>
            <div class="flex flex-col min-w-0">
              <span class="font-label-md text-label-md truncate">{{ i.title }}</span>
              <span class="font-label-xs-mono text-label-xs-mono opacity-80 truncate">{{ i.sub }}</span>
            </div>
          </router-link>
        </nav>
      </div>
      <div class="p-space-md bg-surface-container m-space-sm rounded-lg flex flex-col gap-space-xs font-label-xs-mono text-label-xs-mono">
        <div class="flex justify-between"><span class="uppercase text-outline">Tariff</span><b class="text-primary">{{ L ? 'RM ' + L.tariff + '/kWh' : '–' }}</b></div>
        <div class="flex justify-between"><span class="uppercase text-outline">Baseline (est.)</span><b class="text-primary">{{ L ? L.baselineKw + ' kW' : '–' }}</b></div>
        <div class="flex justify-between"><span class="uppercase text-outline">Data feed</span><b class="text-secondary">{{ feed }}</b></div>
      </div>
    </aside>

    <div class="pl-64">
      <header class="fixed top-0 left-64 right-0 h-16 bg-surface-container-low/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.24)] z-40 flex items-center justify-between px-gutter-desktop">
        <span class="font-headline-sm text-headline-sm text-on-surface">Tanand Energy Monitor</span>
        <div class="flex items-center gap-space-lg">
          <div class="flex items-center gap-space-xs text-on-surface-variant font-label-xs-mono text-label-xs-mono">
            <span class="material-symbols-outlined text-[16px] text-outline">schedule</span>{{ clock }} MYT (UTC+8)
          </div>
          <div class="inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-surface-container">
            <span class="w-2 h-2 rounded-full animate-pulse" :class="down.length ? 'bg-error' : 'bg-secondary'"></span>
            <span class="font-label-xs-mono text-label-xs-mono uppercase tracking-wider" :class="down.length ? 'text-error' : 'text-secondary'">
              {{ down.length ? 'Degraded: ' + down.join(', ') : 'System Operational' }}
            </span>
          </div>
          <div class="flex items-center gap-space-sm">
            <div class="flex flex-col text-right"><span class="font-label-md text-label-md text-on-surface">Nik</span><span class="font-label-xs-mono text-label-xs-mono text-outline">Facilities Lead</span></div>
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><span class="material-symbols-outlined text-on-primary text-[18px]">person</span></div>
          </div>
        </div>
      </header>
      <main class="w-full pt-16 bg-surface-container-lowest min-h-screen px-gutter-desktop py-space-lg">
        <router-view />
      </main>
    </div>
  </div>
</template>
