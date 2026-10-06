<script setup>
import { ref, computed } from 'vue'
import { api } from '../api'
import { live } from '../store'
import { usePolling } from '../polling'
import { n, sg, HRS, TZ } from '../format'
import KpiCard from '../components/KpiCard.vue'
import Section from '../components/Section.vue'
import Pill from '../components/Pill.vue'
import Meter from '../components/Meter.vue'
import ChartBox from '../components/ChartBox.vue'

const s = ref(null)      // numbers from /api/summary (InfluxDB + PostgreSQL)
const error = ref('')
async function load() {
  const d = await api('/api/summary')
  if (d.error) error.value = d.error
  else { s.value = d; error.value = '' }
}
usePolling(load, 10000)

const L = computed(() => live.data)
const t = computed(() => s.value.today)
const y = computed(() => s.value.yesterdaySameTime)
const pct = computed(() => (y.value.kwh ? ((t.value.kwh - y.value.kwh) / y.value.kwh) * 100 : null))
const dCost = computed(() => t.value.cost - y.value.cost)
const el = computed(() => t.value.elapsedHours || 1)
const ac = computed(() => L.value?.status?.airConditioner)
const fan = computed(() => L.value?.status?.ventilationFan)
const on = computed(() => L.value?.control?.automation_enabled)
const alerts = computed(() => L.value?.activeAlerts || 0)
const greeting = computed(() => {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }))
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
})
const today = new Date().toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const chartData = computed(() => [
  { label: 'Today (actual)', data: s.value.hourlyToday, borderColor: '#4cd7f6', backgroundColor: 'rgba(76,215,246,.12)', fill: true, tension: 0.3, pointRadius: 2 },
  { label: 'Yesterday', data: s.value.hourlyYesterday, borderColor: '#869397', borderDash: [5, 5], pointRadius: 0, tension: 0.3 },
])
</script>

<template>
  <div v-if="error" class="rounded-xl bg-surface-container p-space-md text-error">{{ error }}</div>
  <div v-else-if="!s" class="font-body-md text-body-md text-on-surface-variant">Loading…</div>
  <div v-else class="flex flex-col w-full">
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
      <div>
        <div class="flex items-center gap-space-sm flex-wrap">
          <span class="font-headline-xl text-headline-xl text-on-surface">Good {{ greeting }}, Nik</span>
          <Pill :text="alerts ? alerts + ' active alert' + (alerts > 1 ? 's' : '') : 'No active alerts'" :tone="alerts ? 'warn' : 'ok'" />
        </div>
        <div class="font-body-md text-body-md text-on-surface-variant">{{ today }} (MYT)</div>
      </div>
      <router-link to="/data-analytics" class="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold hover:bg-primary">Open Data Analytics →</router-link>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
      <KpiCard label="Energy consumed today" icon="bolt" icon-color="text-tertiary" :big="n(t.kwh)" unit="kWh">
        <template #foot><span v-if="pct == null">No yesterday data</span><span v-else :class="pct > 0 ? 'text-tertiary' : 'text-secondary'">{{ sg(pct) }}%</span></template>
        <template #note>vs yesterday, same time</template>
      </KpiCard>
      <KpiCard label="Energy spend today" icon="payments" :big="'RM ' + n(t.cost, 2)">
        <template #foot>Tariff RM {{ L?.tariff }}/kWh</template><template #note>so far today</template>
      </KpiCard>
      <KpiCard label="Yesterday's total" icon="history" icon-color="text-outline" :big="'RM ' + n(s.yesterday.cost, 2)">
        <template #foot><span :class="dCost > 0 ? 'text-tertiary' : 'text-secondary'">{{ sg(dCost, 2) }} RM</span></template>
        <template #note>today vs same time</template>
      </KpiCard>
      <KpiCard label="Estimated savings" icon="savings" icon-color="text-secondary" :big="'RM ' + n(s.estSavedRm, 2)">
        <template #foot><Pill text="ESTIMATE" tone="warn" /></template>
        <template #note>vs {{ L?.baselineKw }} kW baseline · not verified</template>
      </KpiCard>
    </div>

    <div class="mb-space-lg">
      <Section title="Today's Energy Usage & Baseline" :sub="`Hourly energy (kWh). Dashed line = yesterday as benchmark. Tariff RM ${L?.tariff}/kWh`">
        <div class="h-72"><ChartBox :labels="HRS" :datasets="chartData" legend /></div>
      </Section>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-space-lg mb-space-lg">
      <div class="xl:col-span-2 rounded-xl bg-surface-container p-space-lg shadow-sm">
        <div class="font-headline-lg text-headline-lg text-on-surface mb-space-md">Attention</div>
        <div class="flex gap-space-md p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
          <span class="material-symbols-outlined text-tertiary">trending_up</span>
          <div class="flex-1">
            <div class="flex justify-between gap-2"><b class="font-label-md text-label-md text-on-surface">{{ pct == null ? 'Nothing to compare yet' : `Energy is ${n(Math.abs(pct))}% ${pct > 0 ? 'higher' : 'lower'} than yesterday at the same time` }}</b><span class="font-label-xs-mono text-label-xs-mono text-tertiary">{{ sg(t.kwh - y.kwh) }} kWh</span></div>
            <div class="font-body-md text-body-md text-on-surface-variant">Today {{ n(t.kwh) }} kWh vs {{ n(y.kwh) }} kWh yesterday up to the same hour.</div>
          </div>
        </div>
        <div class="flex gap-space-md p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
          <span class="material-symbols-outlined text-tertiary">ac_unit</span>
          <div class="flex-1">
            <div class="flex justify-between gap-2"><b class="font-label-md text-label-md text-on-surface">AC has run {{ n(t.acHours) }} h today vs {{ n(y.acHours) }} h yesterday at the same time</b><span class="font-label-xs-mono text-label-xs-mono text-tertiary">{{ sg(t.acHours - y.acHours) }} h</span></div>
            <div class="font-body-md text-body-md text-on-surface-variant">Recorded from AC on/off state.</div>
          </div>
        </div>
        <div class="flex gap-space-md p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
          <span class="material-symbols-outlined text-tertiary">query_stats</span>
          <div class="flex-1">
            <div class="flex justify-between gap-2"><b class="font-label-md text-label-md text-on-surface">{{ s.projectedCost == null ? 'Projection needs at least 1 hour of data' : `Projected daily spend: RM ${n(s.projectedCost, 2)}` }}</b><span class="font-label-xs-mono text-label-xs-mono text-tertiary">Projection</span></div>
            <div class="font-body-md text-body-md text-on-surface-variant">Today's cost so far scaled to 24 h ({{ n(el) }} h elapsed). A straight-line projection, not a forecast model.</div>
          </div>
        </div>
        <router-link to="/data-analytics" class="block text-center p-space-sm rounded-lg bg-surface-container-high text-primary font-label-md text-label-md">Investigate in Data Analytics →</router-link>
      </div>

      <div class="rounded-xl bg-surface-container p-space-lg shadow-sm">
        <div class="flex justify-between mb-space-md">
          <div class="font-headline-lg text-headline-lg text-on-surface">Equipment</div>
          <Pill :text="(ac?.power ? 1 : 0) + (fan?.power ? 1 : 0) + ' of 2 on'" tone="ok" />
        </div>
        <div v-if="!ac" class="font-body-md text-body-md text-on-surface-variant">Waiting for MQTT data…</div>
        <template v-else>
          <div class="p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
            <div class="flex justify-between mb-space-xs"><span class="flex items-center gap-2 font-label-md text-label-md text-on-surface"><span class="material-symbols-outlined text-primary">ac_unit</span>Air conditioner</span><Pill :text="`${ac.power ? 'ON' : 'OFF'} · ${ac.setpoint} °C`" :tone="ac.power ? 'ok' : 'mute'" /></div>
            <Meter label="Ran today" :value="n(t.acHours) + ' h'" :pct="(t.acHours / el) * 100" />
          </div>
          <div class="p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
            <div class="flex justify-between mb-space-xs"><span class="flex items-center gap-2 font-label-md text-label-md text-on-surface"><span class="material-symbols-outlined text-primary">mode_fan</span>Ventilation fan</span><Pill :text="fan.power ? 'ON' : 'OFF'" :tone="fan.power ? 'ok' : 'mute'" /></div>
            <Meter label="Ran today" :value="n(t.fanHours) + ' h'" :pct="(t.fanHours / el) * 100" color="bg-secondary" />
          </div>
        </template>
        <div class="p-space-md rounded-lg bg-surface-container-high/50">
          <div class="flex justify-between mb-space-xs"><span class="flex items-center gap-2 font-label-md text-label-md text-on-surface"><span class="material-symbols-outlined text-primary">auto_mode</span>Smart automation</span><Pill :text="on ? 'ACTIVE' : 'OFF'" :tone="on ? 'ok' : 'mute'" /></div>
          <div class="font-body-md text-body-md text-on-surface-variant">{{ s.autoActionsToday }} automation action(s) today. <router-link class="text-primary" to="/system-analytics">Controls →</router-link></div>
        </div>
      </div>
    </div>

    <div class="rounded-xl bg-surface-container p-space-md shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div><b class="font-label-md text-label-md text-on-surface">Tanand Facility</b><div class="font-label-xs-mono text-label-xs-mono text-outline">Tariff RM {{ L?.tariff }}/kWh</div></div>
      <div class="text-right"><div class="font-label-xs-mono text-label-xs-mono uppercase text-outline">Month to date</div><b class="font-headline-sm text-headline-sm text-on-surface">{{ n(s.month.kwh, 0) }} kWh / RM {{ n(s.month.cost, 2) }}</b></div>
    </div>
  </div>
</template>
