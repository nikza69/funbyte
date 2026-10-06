import express from 'express';
import axios from 'axios';
import mqtt from 'mqtt';
import path from 'path';
import { InfluxDB } from '@influxdata/influxdb-client';
import { pool } from './postgres'; // also loads .env
import { TH } from './config';

const SIM = process.env.SIMULATOR_HTTP || 'http://localhost:6677';
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'funbyte/status';
const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const BUCKET = process.env.INFLUX_BUCKET || 'rand';
const TARIFF = Number(process.env.TARIFF_PER_KWH) || 0.365;
const BASELINE_KW = Number(process.env.BASELINE_KW) || 2.3; // ESTIMATE: AC + fan running non-stop
const MYT = 8 * 3600e3; // Malaysia time, UTC+8
const qApi = new InfluxDB({ url: INFLUX_URL, token: process.env.INFLUX_TOKEN }).getQueryApi(process.env.INFLUX_ORG || 'rand');

// ---- live data: listen to the same MQTT topic as the controller ----
let latest: any = null, latestAt = 0;
const mq = mqtt.connect(MQTT_URL);
mq.on('connect', () => mq.subscribe(MQTT_TOPIC));
mq.on('message', (_t, m) => { try { latest = JSON.parse(m.toString()); latestAt = Date.now(); } catch {} });

const health = { pg: false, influx: false, sim: false };
async function checkHealth() {
  health.pg = await pool.query('SELECT 1').then(() => true, () => false);
  health.influx = await axios.get(`${INFLUX_URL}/health`, { timeout: 2000 }).then(() => true, () => false);
  health.sim = await axios.get(`${SIM}/api/status`, { timeout: 2000 }).then(() => true, () => false);
}
checkHealth(); setInterval(checkHealth, 10000);

// ---- helpers ----
const dayStart = (d = new Date()) => new Date(Math.floor((d.getTime() + MYT) / 864e5) * 864e5 - MYT);
const sum = (a: any[], f: string) => a.reduce((s, r) => s + (r[f] || 0), 0);
const avg = (a: any[], f: string) => (a.length ? sum(a, f) / a.length : null);
const tot = (r: any[]) => ({ kwh: sum(r, 'energy_kwh_delta'), cost: sum(r, 'cost_myr_delta'), acHours: sum(r, 'ac_on'),
  fanHours: sum(r, 'fan_on'), temp: avg(r, 'temperature_avg'), activity: avg(r, 'activity_level'), hours: r.length });
// 24 slots (hour of day, MYT) for one field
const slots = (rows: any[], f: string) => { const a = Array(24).fill(null); rows.forEach(r => (a[Math.floor((r.t + MYT) / 36e5) % 24] = r[f])); return a; };
const byDay = (rows: any[]) => { const m = new Map<string, any>();
  rows.forEach(r => { const k = new Date(r.t + MYT).toISOString().slice(0, 10); const o = m.get(k) || { date: k, kwh: 0, cost: 0, acHours: 0, fanHours: 0 };
    o.kwh += r.energy_kwh_delta || 0; o.cost += r.cost_myr_delta || 0; o.acHours += r.ac_on || 0; o.fanHours += r.fan_on || 0; m.set(k, o); });
  return [...m.values()]; };
const portOf = (u: string | undefined, d: string) => { try { return new URL(u || '').port || d; } catch { return d; } };

// One row per hour: energy/cost summed, everything else averaged. t = start of hour (ms).
async function hourly(start: Date, stop: Date) {
  if (stop <= start) return [];
  const run = (fields: string[], fn: string) => qApi.collectRows<any>(
    `from(bucket:"${BUCKET}") |> range(start:${start.toISOString()}, stop:${stop.toISOString()})
     |> filter(fn:(r)=> r._measurement=="office_telemetry" and (${fields.map(f => `r._field=="${f}"`).join(' or ')}))
     |> aggregateWindow(every:1h, fn:${fn}, createEmpty:false)`);
  const [a, b] = await Promise.all([
    run(['energy_kwh_delta', 'cost_myr_delta'], 'sum'),
    run(['temperature_avg', 'activity_level', 'ac_on', 'fan_on'], 'mean'),
  ]);
  const m = new Map<number, any>();
  for (const r of [...a, ...b]) {
    const t = new Date(r._time).getTime() - 36e5; // _time is the END of the window
    const o = m.get(t) || { t }; o[r._field] = r._value; m.set(t, o);
  }
  return [...m.values()].sort((x, y) => x.t - y.t);
}
const getControl = async () => (await pool.query('SELECT * FROM control_state WHERE id = 1')).rows[0];
async function logManual(trigger: string, reason: string, action: string, outcome: string) {
  await pool.query(`INSERT INTO automation_events (source, trigger, reason, action, outcome) VALUES ('manual',$1,$2,$3,$4)`, [trigger, reason, action, outcome]);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const wrap = (fn: express.RequestHandler): express.RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(e => { console.error(e); res.status(500).json({ error: String(e.message || e) }); });

// Cheap, polled every 2s: live readings, health, control state, latest automation action.
app.get('/api/live', wrap(async (_req, res) => {
  const [control, last, alerts] = await Promise.all([
    getControl().catch(() => null),
    pool.query('SELECT * FROM automation_events ORDER BY id DESC LIMIT 1').then(r => r.rows[0]).catch(() => null),
    pool.query("SELECT COUNT(*)::int AS n FROM alerts WHERE status='active'").then(r => r.rows[0].n).catch(() => 0),
  ]);
  res.json({ health: { ...health, mqtt: mq.connected }, status: latest, ageSec: latestAt ? Math.round((Date.now() - latestAt) / 1000) : null,
    control, lastEvent: last, activeAlerts: alerts, thresholds: TH, tariff: TARIFF, baselineKw: BASELINE_KW,
    ports: { mqtt: portOf(MQTT_URL, '1883'), influx: portOf(INFLUX_URL, '8086'), postgres: portOf(process.env.DATABASE_URL, '5432'), simulator: portOf(SIM, '6677') }, payload: latest });
}));

// Heavier (InfluxDB), polled every 10s: Overview page.
app.get('/api/summary', wrap(async (_req, res) => {
  const now = new Date(), ds = dayStart(), yds = new Date(ds.getTime() - 864e5);
  const ms = new Date(new Date(now.getTime() + MYT).toISOString().slice(0, 8) + '01T00:00:00+08:00');
  const [today, yest, yestSame, month, acts] = await Promise.all([
    hourly(ds, now), hourly(yds, ds), hourly(yds, new Date(now.getTime() - 864e5)), hourly(ms, now),
    pool.query("SELECT COUNT(*)::int AS n FROM automation_events WHERE source='automation' AND ts >= $1", [ds]).then(r => r.rows[0].n, () => 0)]);
  const t = tot(today), elapsed = (now.getTime() - ds.getTime()) / 36e5;
  res.json({
    today: { ...t, elapsedHours: elapsed }, yesterday: tot(yest), yesterdaySameTime: tot(yestSame), month: tot(month),
    projectedCost: elapsed >= 1 ? (t.cost / elapsed) * 24 : null,   // straight-line projection, not a forecast model
    autoActionsToday: acts,
    // ESTIMATED, not measured: assumed constant baseline power minus actual use, over hours that have data.
    estSavedKwh: BASELINE_KW * today.length - t.kwh, estSavedRm: (BASELINE_KW * today.length - t.kwh) * TARIFF,
    hourlyToday: slots(today, 'energy_kwh_delta'), hourlyYesterday: slots(yest, 'energy_kwh_delta'),
  });
}));

// One day vs the previous day over the SAME hours (Data Analytics "Today/Yesterday/pick a date" + root cause).
app.get('/api/investigate', wrap(async (req, res) => {
  const s = new Date(`${String(req.query.date)}T00:00:00+08:00`);
  if (isNaN(s.getTime())) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const now = new Date(), full = new Date(s.getTime() + 864e5), e = now > s && now < full ? now : full;
  const ps = new Date(s.getTime() - 864e5), pe = new Date(ps.getTime() + (e.getTime() - s.getTime()));
  const [A, B, ev] = await Promise.all([hourly(s, e), hourly(ps, pe),
    pool.query('SELECT source, action FROM automation_events WHERE ts >= $1 AND ts < $2', [s, e])]);
  const a = tot(A), b = tot(B), f: string[] = [];
  const manual = ev.rows.filter(r => r.source === 'manual'), auto = ev.rows.filter(r => r.source === 'automation');
  if (!a.hours) f.push('No recorded data for this date.');
  else if (!b.hours) f.push('No data for the previous day, so nothing to compare with.');
  else if (a.cost - b.cost > 0.005) {
    if (a.acHours - b.acHours > 0.25) f.push(`AC ran ${a.acHours.toFixed(1)} h vs ${b.acHours.toFixed(1)} h`);
    if (a.fanHours - b.fanHours > 0.25) f.push(`Fan ran ${a.fanHours.toFixed(1)} h vs ${b.fanHours.toFixed(1)} h`);
    if (a.temp - b.temp > 0.5) f.push(`Room averaged ${a.temp.toFixed(1)} °C vs ${b.temp.toFixed(1)} °C`);
    if (a.activity - b.activity > 0.2) f.push(`Activity averaged ${a.activity.toFixed(1)} vs ${b.activity.toFixed(1)} (1 low – 3 high)`);
    if (manual.length) f.push(`${manual.length} manual command(s): ${manual.map(r => r.action).join(', ')}`);
    if (!f.length) f.push('Cost is higher, but no recorded factor explains it.');
  } else f.push('Cost is not higher than the previous day.');
  res.json({ date: req.query.date, from: s, to: e, a: { ...a, hourly: slots(A, 'energy_kwh_delta') }, b: { ...b, hourly: slots(B, 'energy_kwh_delta') },
    costDiff: a.cost - b.cost, findings: f, manualCommands: manual.length, automationActions: auto.length });
}));

// Last N days (daily rows) vs the N days before: 3-day cost bars, weekly (7) and 30-day views.
app.get('/api/range', wrap(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 60);
  const s = new Date(dayStart().getTime() - (days - 1) * 864e5), ps = new Date(s.getTime() - days * 864e5);
  const [cur, prev] = await Promise.all([hourly(s, new Date()), hourly(ps, s)]);
  res.json({ days, daily: byDay(cur), current: tot(cur), previous: tot(prev) });
}));

// ---- controls: a manual command is "held" so automation will not override it ----
const HOLD: Record<string, string> = { ac: 'hold_ac_power', setpoint: 'hold_ac_setpoint', fan: 'hold_fan' };

app.post('/api/automation', wrap(async (req, res) => {
  const on = !!req.body.enabled;
  // Turning automation back ON hands every device back to it.
  await pool.query(`UPDATE control_state SET automation_enabled=$1 ${on ? ', hold_ac_power=FALSE, hold_ac_setpoint=FALSE, hold_fan=FALSE' : ''} WHERE id=1`, [on]);
  await logManual('mode_change', `User switched automation ${on ? 'ON (manual holds cleared)' : 'OFF'}`, `Automation ${on ? 'ON' : 'OFF'}`, 'success');
  res.json(await getControl());
}));

app.post('/api/control', wrap(async (req, res) => {
  const { device, value, auto } = req.body || {};
  const col = HOLD[device];
  if (!col) return res.status(400).json({ error: 'device must be ac, fan or setpoint' });
  if (auto) {
    await pool.query(`UPDATE control_state SET ${col}=FALSE WHERE id=1`);
    await logManual('release', `User returned ${device} to automation`, `${device} → auto`, 'success');
    return res.json({ ok: true });
  }
  let url: string, body: any, action: string;
  if (device === 'setpoint') {
    if (typeof value !== 'number' || value < 18 || value > 30) return res.status(400).json({ error: 'Setpoint must be 18-30' });
    url = `${SIM}/api/ac/setpoint`; body = { setpoint: value }; action = `Setpoint ${value} °C`;
  } else { url = `${SIM}/api/${device}/${value ? 'on' : 'off'}`; action = `${device === 'ac' ? 'AC' : 'Fan'} ${value ? 'ON' : 'OFF'}`; }
  const ok = await axios.post(url, body).then(() => true, () => false);
  if (ok) await pool.query(`UPDATE control_state SET ${col}=TRUE WHERE id=1`);
  await logManual('manual_command', `User command from dashboard; ${device} held against automation`, action, ok ? 'success' : 'failed');
  res.status(ok ? 200 : 502).json({ ok });
}));

app.get('/api/alerts', wrap(async (_req, res) => res.json((await pool.query('SELECT * FROM alerts ORDER BY id DESC LIMIT 30')).rows)));
app.get('/api/events', wrap(async (_req, res) => res.json((await pool.query('SELECT * FROM automation_events ORDER BY id DESC LIMIT 40')).rows)));

const PORT = Number(process.env.DASHBOARD_PORT) || 3000;
app.listen(PORT, () => console.log(`Funbyte dashboard: http://localhost:${PORT}`));
