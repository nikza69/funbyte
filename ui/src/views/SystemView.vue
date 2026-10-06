<script setup>
import { ref, computed } from 'vue'
import { api } from '../api'
import { live, pollLive } from '../store'
import { usePolling } from '../polling'
import { n, tm } from '../format'
import Section from '../components/Section.vue'
import Pill from '../components/Pill.vue'

const alerts = ref([])
const events = ref([])
const filter = ref('all')      // all | active | resolved
async function load() {
  const [a, e] = await Promise.all([api('/api/alerts'), api('/api/events')])
  alerts.value = Array.isArray(a) ? a : []
  events.value = Array.isArray(e) ? e : []
}
usePolling(load, 3000)

const L = computed(() => live.data)
const st = computed(() => L.value?.status)
const c = computed(() => L.value?.control)
const th = computed(() => L.value.thresholds)
const on = computed(() => c.value?.automation_enabled)
const mean = computed(() => (st.value.sensors.temperatureA + st.value.sensors.temperatureB) / 2)
const hot = computed(() => mean.value > th.value.tempHot)
const co2High = computed(() => st.value.sensors.co2 > th.value.co2Alert)
const fanOnMet = computed(() => st.value && (st.value.sensors.co2 > th.value.co2FanOn || st.value.sensors.activity === 'high'))
const fanOffMet = computed(() => st.value && st.value.sensors.co2 < th.value.co2FanOff && st.value.sensors.activity === 'low')
const matches = (a, f) => f === 'all' || (f === 'active' ? a.status === 'active' : a.status === 'resolved')
const shown = computed(() => alerts.value.filter((a) => matches(a, filter.value)).slice(0, 12))
const count = (f) => alerts.value.filter((a) => matches(a, f)).length
const chips = computed(() => {
  const h = L.value.health, p = L.value.ports
  return [
    ['CORE', h.pg && h.influx ? 'ONLINE' : 'CHECK', h.pg && h.influx], ['HOST', location.host, true],
    ['MQTT', p.mqtt, h.mqtt], ['PGSQL', p.postgres, h.pg], ['INFLUX', p.influx, h.influx], ['SIMULATOR', p.simulator, h.sim],
    ['LAST MSG', L.value.ageSec == null ? 'none' : L.value.ageSec + 's ago', L.value.ageSec != null && L.value.ageSec < 30],
  ]
})

// --- actions: UI -> API -> simulator (+ PostgreSQL log + manual hold) ---
async function refresh() { await Promise.all([pollLive(), load()]) }
async function cmd(device, value, auto) {
  const r = await api('/api/control', { device, value, auto })
  if (r.error || r.ok === false) alert(r.error || 'Command failed')
  refresh()
}
async function setAuto(enabled) { await api('/api/automation', { enabled }); refresh() }
function exportAlerts() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(alerts.value, null, 2)], { type: 'application/json' }))
  a.download = 'alerts.json'; a.click()
}
const B = 'px-space-md py-space-sm rounded-lg font-label-md text-label-md font-semibold transition-colors '
const GREY = B + 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
</script>

<template>
  <div v-if="!L" class="font-body-md text-body-md text-on-surface-variant">Loading…</div>
  <div v-else>
    <div class="mb-space-lg">
      <div class="font-headline-xl text-headline-xl text-on-surface">System Analytics</div>
      <div class="font-body-md text-body-md text-on-surface-variant">Live telemetry, manual controls, automation rules and history.</div>
    </div>

    <div class="rounded-xl bg-surface-container p-space-md shadow-sm flex flex-wrap items-center gap-2 mb-space-lg">
      <span v-for="ch in chips" :key="ch[0]" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high font-label-xs-mono text-label-xs-mono">
        <span class="w-1.5 h-1.5 rounded-full" :class="ch[2] ? 'bg-secondary' : 'bg-error'"></span>{{ ch[0] }}: <b>{{ ch[1] }}</b>
      </span>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-5 gap-space-lg mb-space-lg">
      <div class="xl:col-span-3">
        <Section title="Live Sensor Telemetry" sub="Stream: MQTT funbyte/status">
          <div v-if="!st" class="font-body-md text-body-md text-on-surface-variant">Waiting for MQTT data…</div>
          <template v-else>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-space-md">
              <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="font-label-xs-mono text-label-xs-mono uppercase text-outline">Temp sensor A</div><div class="mt-2 font-metric-display text-metric-display">{{ n(st.sensors.temperatureA) }}<span class="font-headline-sm text-headline-sm text-outline"> °C</span></div></div>
              <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="font-label-xs-mono text-label-xs-mono uppercase text-outline">Temp sensor B</div><div class="mt-2 font-metric-display text-metric-display">{{ n(st.sensors.temperatureB) }}<span class="font-headline-sm text-headline-sm text-outline"> °C</span></div></div>
              <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="flex justify-between"><span class="font-label-xs-mono text-label-xs-mono uppercase text-outline">Mean room temp</span><Pill :text="hot ? 'HOT' : 'NORMAL'" :tone="hot ? 'warn' : 'ok'" /></div><div class="mt-2 font-metric-display text-metric-display" :class="hot ? 'text-tertiary' : 'text-primary'">{{ n(mean, 2) }}<span class="font-headline-sm text-headline-sm text-outline"> °C</span></div></div>
              <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="flex justify-between"><span class="font-label-xs-mono text-label-xs-mono uppercase text-outline">CO₂</span><Pill :text="co2High ? 'EXCEEDED ' + th.co2Alert : 'NORMAL'" :tone="co2High ? 'warn' : 'ok'" /></div><div class="mt-2 font-metric-display text-metric-display" :class="co2High ? 'text-tertiary' : ''">{{ st.sensors.co2 }}<span class="font-headline-sm text-headline-sm text-outline"> ppm</span></div></div>
              <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="font-label-xs-mono text-label-xs-mono uppercase text-outline">Activity</div><div class="mt-2 font-metric-display text-metric-display">{{ st.sensors.activity.toUpperCase() }}</div></div>
              <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="font-label-xs-mono text-label-xs-mono uppercase text-outline">AC setpoint</div><div class="mt-2 font-metric-display text-metric-display">{{ st.airConditioner.setpoint }}<span class="font-headline-sm text-headline-sm text-outline"> °C</span></div></div>
            </div>
            <div class="mt-space-md p-space-sm rounded-lg bg-surface-container-lowest font-label-xs-mono text-label-xs-mono text-outline break-all"><b>Live payload (MQTT, {{ L.ageSec }}s ago)</b><br />{{ JSON.stringify(L.payload) }}</div>
          </template>
        </Section>
      </div>

      <div class="xl:col-span-2">
        <Section title="Manual Override">
          <template #actions>
            <button :class="[B, on ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-outline']" @click="setAuto(!on)">AUTO-LOOP: {{ on ? 'ON' : 'OFF' }}</button>
          </template>
          <div v-if="!st || !c" class="font-body-md text-body-md text-on-surface-variant">Waiting for data…</div>
          <template v-else>
            <!-- one block per device: state, buttons, and manual-hold badge with an "Auto" button -->
            <div class="p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
              <div class="flex flex-wrap justify-between items-center gap-2 mb-2"><b class="font-label-md text-label-md text-on-surface">Air conditioner</b><Pill :text="st.airConditioner.power ? 'RUNNING (ON)' : 'OFF'" :tone="st.airConditioner.power ? 'ok' : 'mute'" /></div>
              <div class="flex flex-wrap items-center gap-2">
                <button :class="[B, st.airConditioner.power ? 'bg-secondary text-on-secondary' : GREY]" @click="cmd('ac', true)">ON</button>
                <button :class="[B, !st.airConditioner.power ? 'bg-error text-on-error' : GREY]" @click="cmd('ac', false)">OFF</button>
                <span class="ml-auto flex items-center gap-2">
                  <template v-if="on && c.hold_ac_power"><Pill text="MANUAL HOLD" tone="warn" /><button :class="GREY" @click="cmd('ac', null, true)">Auto</button></template>
                  <Pill v-else :text="on ? 'AUTO' : 'AUTOMATION OFF'" :tone="on ? 'ok' : 'mute'" />
                </span>
              </div>
            </div>
            <div class="p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
              <div class="flex flex-wrap justify-between items-center gap-2 mb-2"><b class="font-label-md text-label-md text-on-surface">AC setpoint</b><Pill :text="st.airConditioner.setpoint + ' °C'" tone="pri" /></div>
              <div class="flex flex-wrap items-center gap-2">
                <button :class="GREY" @click="cmd('setpoint', st.airConditioner.setpoint - 1)">−</button>
                <button :class="GREY" @click="cmd('setpoint', st.airConditioner.setpoint + 1)">+</button>
                <span class="ml-auto flex items-center gap-2">
                  <template v-if="on && c.hold_ac_setpoint"><Pill text="MANUAL HOLD" tone="warn" /><button :class="GREY" @click="cmd('setpoint', null, true)">Auto</button></template>
                  <Pill v-else :text="on ? 'AUTO' : 'AUTOMATION OFF'" :tone="on ? 'ok' : 'mute'" />
                </span>
              </div>
            </div>
            <div class="p-space-md rounded-lg bg-surface-container-high/50 mb-space-sm">
              <div class="flex flex-wrap justify-between items-center gap-2 mb-2"><b class="font-label-md text-label-md text-on-surface">Ventilation fan (on/off only)</b><Pill :text="st.ventilationFan.power ? 'ON' : 'OFF'" :tone="st.ventilationFan.power ? 'ok' : 'mute'" /></div>
              <div class="flex flex-wrap items-center gap-2">
                <button :class="[B, st.ventilationFan.power ? 'bg-secondary text-on-secondary' : GREY]" @click="cmd('fan', true)">ON</button>
                <button :class="[B, !st.ventilationFan.power ? 'bg-error text-on-error' : GREY]" @click="cmd('fan', false)">OFF</button>
                <span class="ml-auto flex items-center gap-2">
                  <template v-if="on && c.hold_fan"><Pill text="MANUAL HOLD" tone="warn" /><button :class="GREY" @click="cmd('fan', null, true)">Auto</button></template>
                  <Pill v-else :text="on ? 'AUTO' : 'AUTOMATION OFF'" :tone="on ? 'ok' : 'mute'" />
                </span>
              </div>
            </div>
          </template>
          <div class="font-label-xs-mono text-label-xs-mono text-outline">A manual command is held: automation won't override it until you press “Auto” or turn AUTO-LOOP back ON.</div>
        </Section>
      </div>
    </div>

    <div class="mb-space-lg">
      <Section title="Automation Rule Diagnostics" sub="The controller evaluates every MQTT message (about every 5 s)">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="flex justify-between mb-1"><span class="font-label-xs-mono text-label-xs-mono uppercase text-outline">Fan ON</span><Pill :text="!on ? 'PAUSED' : fanOnMet ? 'CONDITION MET' : 'WAITING'" :tone="on && fanOnMet ? 'ok' : 'mute'" /></div><div class="font-body-md text-body-md text-on-surface-variant">CO₂ &gt; {{ th.co2FanOn }} ppm, or activity high</div></div>
          <div class="p-space-md rounded-lg bg-surface-container-high/50"><div class="flex justify-between mb-1"><span class="font-label-xs-mono text-label-xs-mono uppercase text-outline">Fan OFF</span><Pill :text="!on ? 'PAUSED' : fanOffMet ? 'CONDITION MET' : 'WAITING'" :tone="on && fanOffMet ? 'ok' : 'mute'" /></div><div class="font-body-md text-body-md text-on-surface-variant">CO₂ &lt; {{ th.co2FanOff }} ppm and activity low</div></div>
          <div class="p-space-md rounded-lg bg-surface-container-high/50">
            <div class="font-label-xs-mono text-label-xs-mono uppercase text-outline mb-1">Last executed action</div>
            <template v-if="L.lastEvent">
              <b class="text-on-surface">{{ L.lastEvent.action }}</b> <Pill :text="L.lastEvent.outcome" :tone="L.lastEvent.outcome === 'success' ? 'ok' : 'bad'" />
              <div class="font-body-md text-body-md text-on-surface-variant">{{ L.lastEvent.reason }}</div>
              <div class="font-label-xs-mono text-label-xs-mono text-outline mt-1">{{ tm(L.lastEvent.ts) }} · {{ L.lastEvent.source }}<span v-if="L.lastEvent.measured_value != null"> · measured {{ n(L.lastEvent.measured_value) }} {{ L.lastEvent.unit }}</span><span v-if="L.lastEvent.threshold != null"> / threshold {{ n(L.lastEvent.threshold) }}</span></div>
            </template>
            <div v-else class="font-body-md text-body-md text-on-surface-variant">None yet.</div>
          </div>
        </div>
        <div class="font-label-xs-mono text-label-xs-mono text-outline mt-space-sm">Setpoint: activity low/medium/high → {{ th.targets.low }}/{{ th.targets.medium }}/{{ th.targets.high }} °C, −{{ th.hotOffset }} °C when room &gt; {{ th.tempHot }} °C (min {{ th.minSetpoint }}) · AC switches ±{{ th.deadband }} °C around setpoint, at least {{ th.minSwitchMs / 60000 }} min apart.</div>
      </Section>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-space-lg">
      <Section title="Alerts Ledger">
        <div class="flex gap-2 mb-space-sm">
          <button v-for="f in [['all', 'All'], ['active', 'Active'], ['resolved', 'Resolved']]" :key="f[0]" @click="filter = f[0]"
            class="px-3 py-1 rounded font-label-xs-mono text-label-xs-mono font-bold" :class="filter === f[0] ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'">{{ f[1] }} ({{ count(f[0]) }})</button>
          <button class="ml-auto px-3 py-1 rounded bg-surface-container-high font-label-xs-mono text-label-xs-mono font-bold text-on-surface" @click="exportAlerts">Export JSON</button>
        </div>
        <div v-if="!shown.length" class="font-body-md text-body-md text-on-surface-variant">No records yet.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left">
            <thead><tr><th v-for="h in ['Time', 'Type', 'Severity', 'Message', 'Status']" :key="h" class="py-2 pr-4 font-label-xs-mono text-label-xs-mono uppercase tracking-wider text-outline">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-for="a in shown" :key="a.id" class="border-t border-outline-variant/40">
                <td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ tm(a.created_at) }}</td>
                <td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ a.alert_type.replace(/_/g, ' ') }}</td>
                <td class="py-2 pr-4"><Pill :text="a.severity" :tone="a.severity === 'critical' ? 'bad' : a.severity === 'warning' ? 'warn' : 'pri'" /></td>
                <td class="py-2 pr-4 font-body-sm text-body-sm text-on-surface">{{ a.message }}</td>
                <td class="py-2 pr-4"><Pill :text="a.status" :tone="a.status === 'active' ? 'warn' : 'ok'" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Automation & Manual Log" :sub="events.length + ' recent entries'">
        <div class="p-space-sm rounded-lg bg-surface-container-lowest font-label-xs-mono text-label-xs-mono h-72 overflow-y-auto space-y-1">
          <div v-if="!events.length" class="text-outline">No events yet.</div>
          <div v-for="x in events" :key="x.id" :class="x.outcome === 'failed' ? 'text-error' : x.source === 'manual' ? 'text-tertiary' : 'text-secondary'">
            <span class="text-outline">[{{ tm(x.ts) }}]</span> <b>{{ x.source }}</b> {{ x.action }} — {{ x.reason }}<span v-if="x.measured_value != null"> ({{ n(x.measured_value) }}<span v-if="x.threshold != null"> / {{ n(x.threshold) }}</span> {{ x.unit }})</span> → {{ x.outcome }}
          </div>
        </div>
      </Section>
    </div>
  </div>
</template>
