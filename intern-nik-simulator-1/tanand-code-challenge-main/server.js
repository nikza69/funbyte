'use strict';

const express = require('express');
const path = require('node:path');
const cors = require('cors');
const morgan = require('morgan');
const mqtt = require('mqtt');

const { OfficeSimulator, LIMITS } = require('./simulator');

const app = express();
const PORT = process.env.PORT || 6677;
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'funbyte/status';
const MQTT_PUBLISH_INTERVAL_MS = 5000;

const simulator = new OfficeSimulator();
simulator.start();

const mqttClient = mqtt.connect(MQTT_URL);
mqttClient.on('connect', () => console.log(`MQTT connected: ${MQTT_URL}`));
mqttClient.on('error', (err) => console.error('MQTT error:', err.message));

const mqttPublishTimer = setInterval(() => {
  mqttClient.publish(MQTT_TOPIC, JSON.stringify(simulator.getStatus()));
}, MQTT_PUBLISH_INTERVAL_MS);
mqttPublishTimer.unref();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- API 1: Get Room Status ------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json(simulator.getStatus());
});

// ---- API 2: Turn AC On -----------------------------------------------------

app.post('/api/ac/on', (req, res) => {
  const { power } = simulator.turnAcOn();
  res.json({ success: true, power });
});

// ---- API 3: Turn AC Off ----------------------------------------------------

app.post('/api/ac/off', (req, res) => {
  const { power } = simulator.turnAcOff();
  res.json({ success: true, power });
});

// ---- API 4: Set AC Temperature ---------------------------------------------

app.post('/api/ac/setpoint', (req, res) => {
  const { setpoint } = req.body ?? {};

  if (typeof setpoint !== 'number' || !Number.isFinite(setpoint)) {
    return res.status(400).json({ success: false, error: 'Setpoint must be a number' });
  }

  try {
    const status = simulator.setAcSetpoint(setpoint);
    res.json({ success: true, setpoint: status.setpoint });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// ---- API 5: Get AC Status ---------------------------------------------------

app.get('/api/ac', (req, res) => {
  res.json(simulator.getAcStatus());
});

// ---- API 6: Ventilation Fan Control -----------------------------------------

app.post('/api/fan/on', (req, res) => {
  const { power } = simulator.turnFanOn();
  res.json({ success: true, power });
});

app.post('/api/fan/off', (req, res) => {
  const { power } = simulator.turnFanOff();
  res.json({ success: true, power });
});

app.get('/api/fan', (req, res) => {
  res.json(simulator.getFanStatus());
});

// ---- API 7: Prometheus / InfluxDB scrape endpoint ---------------------------

app.get('/metrics', (req, res) => {
  const { sensors, airConditioner, ventilationFan } = simulator.getStatus();
  const activityLevelCodes = { low: 1, medium: 2, high: 3 };

  const lines = [
    '# HELP temperature_celsius Temperature sensor reading in Celsius.',
    '# TYPE temperature_celsius gauge',
    `temperature_celsius{sensor="A"} ${sensors.temperatureA}`,
    `temperature_celsius{sensor="B"} ${sensors.temperatureB}`,

    '# HELP humidity_percent Humidity sensor reading in percent relative humidity.',
    '# TYPE humidity_percent gauge',
    `humidity_percent{sensor="A"} ${sensors.humidityA}`,
    `humidity_percent{sensor="B"} ${sensors.humidityB}`,

    '# HELP co2_ppm CO2 concentration in parts per million.',
    '# TYPE co2_ppm gauge',
    `co2_ppm ${sensors.co2}`,

    '# HELP power_kw Total power draw in kilowatts.',
    '# TYPE power_kw gauge',
    `power_kw ${sensors.powerKw}`,

    '# HELP activity_level Human activity level (1 = low, 2 = medium, 3 = high).',
    '# TYPE activity_level gauge',
    `activity_level ${activityLevelCodes[sensors.activity]}`,

    '# HELP ac_power Air conditioner power state (1 = on, 0 = off).',
    '# TYPE ac_power gauge',
    `ac_power ${airConditioner.power ? 1 : 0}`,

    '# HELP ac_setpoint_celsius Air conditioner target temperature setpoint in Celsius.',
    '# TYPE ac_setpoint_celsius gauge',
    `ac_setpoint_celsius ${airConditioner.setpoint}`,

    '# HELP ac_mode Air conditioner mode (1 = active mode, 0 otherwise).',
    '# TYPE ac_mode gauge',
    `ac_mode{mode="${airConditioner.mode}"} 1`,

    '# HELP fan_power Ventilation fan power state (1 = on, 0 = off).',
    '# TYPE fan_power gauge',
    `fan_power ${ventilationFan.power ? 1 : 0}`,
  ];

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

// ---- Fallback 404 for unknown API routes -----------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ---- Error handler -----------------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Office HVAC Simulator listening on http://localhost:${PORT}`);
  console.log(`Setpoint range: ${LIMITS.setpoint.min}-${LIMITS.setpoint.max}`);
});

module.exports = app;
