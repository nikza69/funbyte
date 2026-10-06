import mqtt from 'mqtt';
import axios from 'axios';
import { pool, testPostgres } from './postgres';
import { TH } from './config';

testPostgres().catch((error) => {
  console.error('[POSTGRES] Connection failed:', error);
});

const SIM = process.env.SIMULATOR_HTTP || 'http://localhost:6677';
const client = mqtt.connect(
  process.env.MQTT_URL || 'mqtt://localhost:1883'
);

client.on('connect', () => {
  console.log(' Connected to MQTT broker');

  client.subscribe(
    process.env.MQTT_TOPIC || 'funbyte/status',
    (err) => {
      if (err) {
        console.error(' Subscribe error:', err);
      } else {
        console.log(' Subscribed to funbyte/status');
      }
    }
  );
});

client.on('error', (error) => {
  console.error(' MQTT error:', error);
});

client.on('offline', () => {
  console.log(' MQTT client offline');
});

client.on('reconnect', () => {
  console.log(' Attempting MQTT reconnect...');
});




// ---- Thresholds (single place; also written into every alert/event) ----
let lastSwitchTime = 0;

// State written by the dashboard. If it can't be read we do nothing (fail safe: never override a human).
async function getControl() {
  try {
    const r = await pool.query('SELECT * FROM control_state WHERE id = 1');
    if (r.rows[0]) return r.rows[0];
  } catch (e) { console.error('[CONTROL] state read failed:', e); }
  return { automation_enabled: false, hold_ac_power: true, hold_ac_setpoint: true, hold_fan: true };
}

interface Ev { trigger: string; reason: string; action: string; measured?: number; threshold?: number; unit?: string }

// Send a command, update the failure alert, and record the automation event with its outcome.
async function sendCommand(url: string, body: object | undefined, alertName: string, errorMessage: string, ev: Ev) {
  let ok = true;
  try { await axios.post(url, body); await resolveAlert(alertName); }
  catch { ok = false; await createOrUpdateAlert(alertName, 'critical', errorMessage); }
  try {
    await pool.query(
      `INSERT INTO automation_events (source, trigger, reason, action, measured_value, threshold, unit, outcome)
       VALUES ('automation', $1, $2, $3, $4, $5, $6, $7)`,
      [ev.trigger, ev.reason, ev.action, ev.measured ?? null, ev.threshold ?? null, ev.unit ?? null, ok ? 'success' : 'failed']
    );
  } catch (e) { console.error('[EVENT] Failed to store:', e); }
  return ok;
}

client.on('message', async (_, msg) => {
  const { sensors, airConditioner, ventilationFan } = JSON.parse(msg.toString());
  const temp = (sensors.temperatureA + sensors.temperatureB) / 2;
  const t1 = Math.round(temp * 10) / 10;

  // Alerts always run (monitoring), even when automation is OFF.
  if (sensors.co2 > TH.co2Alert) await createOrUpdateAlert('high_co2', 'warning', `CO2 level is high: ${sensors.co2} ppm`, sensors.co2, TH.co2Alert, 'ppm');
  else await resolveAlert('high_co2');
  if (temp > TH.tempHot) await createOrUpdateAlert('high_temperature', 'warning', `Room temperature is high: ${t1} °C`, t1, TH.tempHot, '°C');
  else await resolveAlert('high_temperature');

  const ctl = await getControl();
  if (!ctl.automation_enabled) return; // automation OFF: observe only

  // 1. Fan (skipped while a manual fan command is held)
  if (!ctl.hold_fan) {
    const co2High = sensors.co2 > TH.co2FanOn, busy = sensors.activity === 'high';
    if ((co2High || busy) && !ventilationFan.power) {
      await sendCommand(`${SIM}/api/fan/on`, undefined, 'fan_control_failure', 'Failed to turn ventilation fan ON', co2High
        ? { trigger: 'co2_above_threshold', reason: `CO2 ${sensors.co2} ppm exceeded ${TH.co2FanOn} ppm`, action: 'Fan ON', measured: sensors.co2, threshold: TH.co2FanOn, unit: 'ppm' }
        : { trigger: 'activity_high', reason: 'Activity level is high', action: 'Fan ON', measured: 3, threshold: 3, unit: 'level' });
    }
    if (sensors.co2 < TH.co2FanOff && sensors.activity === 'low' && ventilationFan.power) {
      await sendCommand(`${SIM}/api/fan/off`, undefined, 'fan_control_failure', 'Failed to turn ventilation fan OFF',
        { trigger: 'co2_below_threshold', reason: `CO2 ${sensors.co2} ppm below ${TH.co2FanOff} ppm and activity low`, action: 'Fan OFF', measured: sensors.co2, threshold: TH.co2FanOff, unit: 'ppm' });
    }
  }

  // 2. AC setpoint: activity picks the target, hot room lowers it 2 degrees, never below 22
  let target = TH.targets[sensors.activity] ?? TH.targets.medium;
  if (temp > TH.tempHot) target -= TH.hotOffset;
  if (target < TH.minSetpoint) target = TH.minSetpoint;

  if (!ctl.hold_ac_setpoint && airConditioner.setpoint !== target) {
    await sendCommand(`${SIM}/api/ac/setpoint`, { setpoint: target }, 'ac_setpoint_control_failure', 'Failed to change AC setpoint', {
      trigger: temp > TH.tempHot ? 'temperature_above_threshold' : 'activity_change',
      reason: `Activity ${sensors.activity}${temp > TH.tempHot ? `, room ${t1} °C above ${TH.tempHot} °C` : ''}: setpoint ${airConditioner.setpoint} → ${target} °C`,
      action: `Setpoint ${target} °C`, measured: t1, threshold: temp > TH.tempHot ? TH.tempHot : undefined, unit: '°C' });
  }

  // 3. AC power (skipped while manual AC power is held). Uses the real setpoint if a human set it.
  const effTarget = ctl.hold_ac_setpoint ? airConditioner.setpoint : target;
  if (!ctl.hold_ac_power && Date.now() - lastSwitchTime > TH.minSwitchMs) {
    if (temp > effTarget + TH.deadband && !airConditioner.power) {
      const ok = await sendCommand(`${SIM}/api/ac/on`, undefined, 'ac_power_control_failure', 'Failed to turn AC ON',
        { trigger: 'temperature_above_target', reason: `Room ${t1} °C above target ${effTarget} °C + ${TH.deadband}`, action: 'AC ON', measured: t1, threshold: effTarget + TH.deadband, unit: '°C' });
      if (ok) lastSwitchTime = Date.now();
    } else if (temp < effTarget - TH.deadband && airConditioner.power) {
      const ok = await sendCommand(`${SIM}/api/ac/off`, undefined, 'ac_power_control_failure', 'Failed to turn AC OFF',
        { trigger: 'temperature_below_target', reason: `Room ${t1} °C below target ${effTarget} °C − ${TH.deadband}`, action: 'AC OFF', measured: t1, threshold: effTarget - TH.deadband, unit: '°C' });
      if (ok) lastSwitchTime = Date.now();
    }
  }
});

// Alerts (Store in postgre)
async function createOrUpdateAlert(
  alertType: string,
  severity: 'info' | 'warning' | 'critical',
  message: string,
  observedValue?: number,
  threshold?: number,
  unit?: string
) {
  try {
    const existing = await pool.query(
      `
      SELECT id
      FROM alerts
      WHERE alert_type = $1
        AND status = 'active'
      LIMIT 1
      `,
      [alertType]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `
        UPDATE alerts
        SET
          last_seen_at = NOW(),
          observed_value = $2,
          threshold = $3,
          unit = $4,
          message = $5,
          severity = $6
        WHERE id = $1
        `,
        [
          existing.rows[0].id,
          observedValue ?? null,
          threshold ?? null,
          unit ?? null,
          message,
          severity,
        ]
      );

      console.log(`[ALERT] Updated: ${alertType}`);
    } else {
      await pool.query(
        `
        INSERT INTO alerts
        (
          alert_type,
          severity,
          message,
          observed_value,
          threshold,
          unit
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          alertType,
          severity,
          message,
          observedValue ?? null,
          threshold ?? null,
          unit ?? null,
        ]
      );

      console.log(`[ALERT] Created: ${alertType}`);
    }
  } catch (error) {
    console.error(`[ALERT] Failed to store ${alertType}:`, error);
  }
}

async function resolveAlert(alertType: string) {
  try {
    const result = await pool.query(
      `
      UPDATE alerts
      SET
        status = 'resolved',
        resolved_at = NOW(),
        last_seen_at = NOW()
      WHERE alert_type = $1
        AND status = 'active'
      `,
      [alertType]
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`[ALERT] Resolved: ${alertType}`);
    }
  } catch (error) {
    console.error(`[ALERT] Failed to resolve ${alertType}:`, error);
  }
}

// Analysis