<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../api'
import { live } from '../store'
import { usePolling } from '../polling'
import { n, sg, myd, HRS } from '../format'
import KpiCard from '../components/KpiCard.vue'
import Section from '../components/Section.vue'
import Pill from '../components/Pill.vue'
import Meter from '../components/Meter.vue'
import ChartBox from '../components/ChartBox.vue'

// What the user picked: one day (today / yesterday / any date) or the last N days.
const mode = ref('day')
const date = ref(myd())
const days = ref(7)
const res = ref(null)    // { day: boolean, x: server answer, r3: last 3 days }
const error = ref('')

async function load() {
  const day = mode.value === 'day'
  const [r3, x] = await Promise.all([
    api('/api/range?days=3'),
    day ? api('/api/investigate?date=' + date.value) : api('/api/range?days=' + days.value),
  ])
  if (x.error) { error.value = x.error; return }
  error.value = ''
  res.value = { day, x, r3 }     // keep the mode together with the data so the page never mixes the two shapes
}
usePolling(load, 30000)
watch([mode, date, days], load)

const pick = (m, d) => { mode.value = m; if (m === 'day') date.value = d; else days.value = d }
const isDay = (d) => mode.value === 'day' && date.value === d
const L = computed(() => live.data)
const V = computed(() => res.value)
const A = computed(() => (V.value.day ? V.value.x.a : V.value.x.current))     // selected period
const B = computed(() => (V.value.day ? V.value.x.b : V.value.x.previous))    // comparison period
const cd = computed(() => A.value.cost - B.value.cost)
const ed = computed(() => A.value.kwh - B.value.kwh)
const cp = computed(() => (B.value.cost ? (cd.value / B.value.cost) * 100 : null))
const est = computed(() => L.value.baselineKw * A.value.hours - A.value.kwh)  // ESTIMATE only
const cmpLabel = computed(() => (V.value.day ? 'Previous day, same hours' : 'Previous ' + days.value + ' days'))
const r3 = computed(() => V.value.r3.daily || [])
const rows = computed(() => [
  ['Air conditioner (hours on)', n(A.value.acHours), n(B.value.acHours), sg(A.value.acHours - B.value.acHours) + ' h'],
  ['Ventilation fan (hours on)', n(A.value.fanHours), n(B.value.fanHours), sg(A.value.fanHours - B.value.fanHours) + ' h'],
  ['Avg room temperature', n(A.value.temp) + ' °C', n(B.value.temp) + ' °C', sg(A.value.temp - B.value.temp) + ' °C'],
  ['Avg activity (1–3)', n(A.value.activity), n(B.value.activity), sg(A.value.activity - B.value.activity)],
  ['Energy', n(A.value.kwh) + ' kWh', n(B.value.kwh) + ' kWh', sg(ed.value) + ' kWh'],
  ['Cost', 'RM ' + n(A.value.cost, 2), 'RM ' + n(B.value.cost, 2), sg(cd.value, 2) + ' RM'],
])
// the four "why" cards: only recorded measurements
const why = computed(() => [
  { t: 'AC runtime', a: n(A.value.acHours), b: n(B.value.acHours), u: 'h', d: A.value.acHours - B.value.acHours, hi: 'Higher' },
  { t: 'Fan runtime', a: n(A.value.fanHours), b: n(B.value.fanHours), u: 'h', d: A.value.fanHours - B.value.fanHours, hi: 'Higher' },
  { t: 'Room temperature', a: n(A.value.temp), b: n(B.value.temp), u: '°C', d: A.value.temp - B.value.temp, hi: 'Warmer' },
  { t: 'Activity level', a: n(A.value.activity), b: n(B.value.activity), u: '', d: A.value.activity - B.value.activity, hi: 'Busier' },
])
const profile = computed(() => [
  { label: date.value, data: A.value.hourly, borderColor: '#4cd7f6', backgroundColor: 'rgba(76,215,246,.12)', fill: true, tension: 0.3, pointRadius: 2 },
  { label: 'Previous day', data: B.value.hourly, borderColor: '#869397', borderDash: [5, 5], pointRadius: 0, tension: 0.3 },
])
const daily = computed(() => V.value.x.daily || [])
const BTN = 'px-space-md py-space-sm rounded-lg font-label-md text-label-md font-semibold transition-colors '
const ON = 'bg-primary-container text-on-primary-container', OFF = 'bg-surface-container-high text-on-surface'
</script>

<template>
  <div v-if="error" class="rounded-xl bg-surface-container p-space-md text-error">{{ error }}</div>
  <div v-else-if="!V || !L" class="font-body-md text-body-md text-on-surface-variant">Loading…</div>
  <div v-else>
    <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md mb-space-lg">
      <div>
        <div class="flex items-center gap-space-sm flex-wrap">
          <span class="font-headline-xl text-headline-xl text-on-surface">Energy &amp; Cost Analytics</span>
          <Pill :text="`TARIFF: RM ${L.tariff}/KWH`" tone="pri" />
        </div>
        <div class="font-body-md text-body-md text-on-surface-variant">{{ V.day ? 'Selected day compared with the previous day over the same hours.' : `Daily totals for the last ${days} days, compared with the ${days} days before.` }}</div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button :class="[BTN, isDay(myd()) ? ON : OFF]" @click="pick('day', myd())">Today</button>
        <button :class="[BTN, isDay(myd(-1)) ? ON : OFF]" @click="pick('day', myd(-1))">Yesterday</button>
        <button :class="[BTN, mode === 'range' && days === 7 ? ON : OFF]" @click="pick('range', 7)">Last 7 Days (weekly)</button>
        <button :class="[BTN, mode === 'range' && days === 30 ? ON : OFF]" @click="pick('range', 30)">Last 30 Days</button>
        <input type="date" :value="V.day ? date : ''" :max="myd()" @change="(e) => e.target.value && pick('day', e.target.value)"
          class="px-space-sm py-space-sm rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-lg">
      <KpiCard label="Energy consumption" icon="bolt" :big="n(A.kwh)" unit="kWh">
        <template #foot><span :class="ed > 0 ? 'text-tertiary' : 'text-secondary'">{{ sg(ed) }} kWh</span></template>
        <template #note>{{ cmpLabel }}: {{ n(B.kwh) }}</template>
      </KpiCard>
      <KpiCard label="Electricity cost" icon="payments" :big="'RM ' + n(A.cost, 2)">
        <template #foot><span :class="cd > 0 ? 'text-tertiary' : 'text-secondary'">{{ sg(cd, 2) }} RM{{ cp == null ? '' : ' (' + sg(cp) + '%)' }}</span></template>
        <template #note>{{ cmpLabel }}: RM {{ n(B.cost, 2) }}</template>
      </KpiCard>
      <KpiCard label="Estimated savings" icon="savings" icon-color="text-secondary" :big="'RM ' + n(est * L.tariff, 2)">
        <template #foot><Pill text="ESTIMATE" tone="warn" /></template>
        <template #note>{{ n(est) }} kWh vs {{ L.baselineKw }} kW assumed baseline. Not measured.</template>
      </KpiCard>
    </div>

    <div v-if="V.day" class="mb-space-lg">
      <Section title="Actual vs previous day" :sub="`Same hours; actual measured energy against the previous day's ${n(B.kwh)} kWh.`">
        <Meter :label="`Actual ${n(A.kwh)} kWh`" :value="B.kwh ? n((A.kwh / B.kwh) * 100, 0) + '% of previous day' : '–'" :pct="B.kwh ? (A.kwh / B.kwh) * 100 : 0" :color="A.kwh > B.kwh ? 'bg-tertiary' : 'bg-secondary'" />
      </Section>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-space-lg mb-space-lg">
      <div class="xl:col-span-2">
        <Section :title="V.day ? '24-Hour Energy Profile' : 'Daily Energy'" :sub="V.day ? 'Hourly kWh. Dashed = previous day.' : 'kWh per day'">
          <div class="h-72">
            <ChartBox v-if="V.day" :labels="HRS" :datasets="profile" legend />
            <ChartBox v-else type="bar" :labels="daily.map((d) => d.date.slice(5))" :datasets="[{ label: 'kWh', data: daily.map((d) => d.kwh), backgroundColor: '#4cd7f6' }]" />
          </div>
        </Section>
      </div>
      <Section :title="V.day ? 'Why it differs (recorded evidence)' : 'Cost per day'">
        <template v-if="V.day">
          <div v-for="f in V.x.findings" :key="f" class="p-space-sm rounded-lg bg-surface-container-high/50 mb-space-xs font-body-md text-body-md text-on-surface-variant">• {{ f }}</div>
          <div class="font-label-xs-mono text-label-xs-mono text-outline mt-2">{{ V.x.automationActions }} automation action(s) · {{ V.x.manualCommands }} manual command(s) in this window</div>
        </template>
        <div v-else class="h-64"><ChartBox type="bar" :labels="daily.map((d) => d.date.slice(5))" :datasets="[{ label: 'RM', data: daily.map((d) => d.cost), backgroundColor: '#ffb690' }]" /></div>
      </Section>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-space-lg mb-space-lg">
      <Section title="3-Day Cost Comparison" sub="RM per day (today is so far)">
        <div class="h-56"><ChartBox type="bar" :labels="r3.map((d) => d.date.slice(5))" :datasets="[{ data: r3.map((d) => d.cost), backgroundColor: ['#3d494c', '#4edea3', '#ffb690'] }]" /></div>
      </Section>
      <div class="xl:col-span-2">
        <Section :title="V.day ? 'Equipment & Conditions Audit' : 'Daily Detail'" :sub="V.day ? 'From recorded AC/fan state and sensors' : ''">
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead><tr><th v-for="h in V.day ? ['Measure', 'Selected', cmpLabel, 'Variance'] : ['Date', 'kWh', 'Cost (RM)', 'AC (h)', 'Fan (h)']" :key="h" class="py-2 pr-4 font-label-xs-mono text-label-xs-mono uppercase tracking-wider text-outline">{{ h }}</th></tr></thead>
              <tbody v-if="V.day"><tr v-for="r in rows" :key="r[0]" class="border-t border-outline-variant/40"><td v-for="(c, i) in r" :key="i" class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ c }}</td></tr></tbody>
              <tbody v-else><tr v-for="d in daily" :key="d.date" class="border-t border-outline-variant/40">
                <td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ d.date }}</td><td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ n(d.kwh) }}</td><td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ n(d.cost, 2) }}</td><td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ n(d.acHours) }}</td><td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ n(d.fanHours) }}</td></tr></tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>

    <Section v-if="V.day" :title="'Why is the electricity cost ' + (cd > 0 ? 'higher' : 'different') + '?'" sub="Compared with the previous day over the same hours. Evidence only; nothing is guessed.">
      <template #actions><Pill :text="'BILL DIFFERENCE: ' + sg(cd, 2) + ' RM' + (cp == null ? '' : ' (' + sg(cp) + '%)')" :tone="cd > 0 ? 'warn' : 'ok'" /></template>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <div v-for="w in why" :key="w.t" class="rounded-xl bg-surface-container-high/50 p-space-md">
          <div class="font-label-xs-mono text-label-xs-mono uppercase tracking-wider text-outline mb-1">{{ w.t }}</div>
          <div class="font-headline-lg text-headline-lg" :class="w.d > 0.05 ? 'text-tertiary' : 'text-on-surface'">{{ sg(w.d) }} {{ w.u }}</div>
          <div class="font-body-md text-body-md text-on-surface-variant">Recorded: {{ w.a }} vs {{ w.b }} {{ w.u }}</div>
          <div class="mt-2"><Pill :text="w.d > 0.05 ? w.hi : w.d < -0.05 ? 'Lower' : 'Similar'" :tone="w.d > 0.05 ? 'warn' : 'mute'" /></div>
        </div>
      </div>
    </Section>
  </div>
</template>
