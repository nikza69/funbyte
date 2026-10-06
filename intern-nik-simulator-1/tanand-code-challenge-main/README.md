# Office HVAC Simulator

A Node.js black-box office environment simulator exposing REST APIs for reading
sensor data and controlling a split-unit air conditioner. Built for testing AI
agents, automation systems, dashboards, and IoT integrations against realistic
(but simplified) HVAC behavior.

## Overview

The simulator models a single office room:

- **2x temperature sensors** (A & B) — °C, each with independent ±0.2°C noise
- **2x humidity sensors** (A & B) — %RH, each with independent ±1%RH noise
- **1x CO2 sensor** — ppm, rises with occupant activity, ±15ppm noise
- **1x power meter** — kW, tracks live draw from AC (dominant contributor) and fan, ±0.05kW noise
- **1x human activity sensor** — `low` / `medium` / `high`, changes automatically every 5-15 minutes
- **1x split-unit air conditioner** — on/off power, temperature setpoint, cool mode only
- **1x ventilation fan** — on/off power, pulls in fresh outdoor air to lower CO2 faster

The room has an internal, hidden thermal state (temperature and humidity) that
drives a simulation loop running every second, independent of API traffic. See
[Black-Box Design](#black-box-design) below.

## Installation

Requires Node.js 20+.

```bash
npm install
```

## Running

```bash
npm start
```

Server starts on `http://localhost:6677`. Visit that URL for interactive API
documentation.

## Project Structure

```text
project/
│
├── package.json
├── server.js         # Express app & route definitions
├── simulator.js       # OfficeSimulator class: thermal model + simulation loop
│
├── public/
│   └── index.html      # API documentation page
└── README.md
```

Simulator logic is fully separated from HTTP routing, so additional sensors or
equipment can be added to `simulator.js` and wired into new routes in
`server.js` without touching the core simulation loop.

## API Documentation

Base URL: `http://localhost:6677`

### GET /api/status

Returns all sensor readings and AC status.

**Response**

```json
{
  "sensors": {
    "temperatureA": 25.4,
    "temperatureB": 25.2,
    "humidityA": 56.8,
    "humidityB": 55.9,
    "co2": 612,
    "powerKw": 2.7,
    "activity": "medium"
  },
  "airConditioner": {
    "power": true,
    "setpoint": 24,
    "mode": "cool"
  },
  "ventilationFan": {
    "power": false
  }
}
```

### POST /api/ac/on

Turns the AC on.

**Response**

```json
{ "success": true, "power": true }
```

### POST /api/ac/off

Turns the AC off.

**Response**

```json
{ "success": true, "power": false }
```

### POST /api/ac/setpoint

Sets the AC temperature setpoint. Valid range: 18-30.

**Request**

```json
{ "setpoint": 23 }
```

**Response**

```json
{ "success": true, "setpoint": 23 }
```

**Error (400 Bad Request)**

```json
{ "success": false, "error": "Setpoint must be between 18 and 30" }
```

### GET /api/ac

Returns current AC status.

**Response**

```json
{ "power": true, "setpoint": 24, "mode": "cool" }
```

### POST /api/fan/on

Turns the ventilation fan on.

**Response**

```json
{ "success": true, "power": true }
```

### POST /api/fan/off

Turns the ventilation fan off.

**Response**

```json
{ "success": true, "power": false }
```

### GET /api/fan

Returns current ventilation fan status.

**Response**

```json
{ "power": false }
```

### GET /metrics

Prometheus text-format exposition of all sensor and actuator state, for
scraping by Prometheus, InfluxDB (Telegraf `inputs.prometheus`), or similar.

**Response**

```text
# HELP temperature_celsius Temperature sensor reading in Celsius.
# TYPE temperature_celsius gauge
temperature_celsius{sensor="A"} 25.4
temperature_celsius{sensor="B"} 25.2
# HELP humidity_percent Humidity sensor reading in percent relative humidity.
# TYPE humidity_percent gauge
humidity_percent{sensor="A"} 56.8
humidity_percent{sensor="B"} 55.9
# HELP co2_ppm CO2 concentration in parts per million.
# TYPE co2_ppm gauge
co2_ppm 612
# HELP power_kw Total power draw in kilowatts.
# TYPE power_kw gauge
power_kw 2.7
# HELP activity_level Human activity level (1 = low, 2 = medium, 3 = high).
# TYPE activity_level gauge
activity_level 2
# HELP ac_power Air conditioner power state (1 = on, 0 = off).
# TYPE ac_power gauge
ac_power 1
# HELP ac_setpoint_celsius Air conditioner target temperature setpoint in Celsius.
# TYPE ac_setpoint_celsius gauge
ac_setpoint_celsius 24
# HELP ac_mode Air conditioner mode (1 = active mode, 0 otherwise).
# TYPE ac_mode gauge
ac_mode{mode="cool"} 1
# HELP fan_power Ventilation fan power state (1 = on, 0 = off).
# TYPE fan_power gauge
fan_power 0
```

## MQTT Publishing

Alongside the REST API, the server publishes the same `getStatus()` payload
(sensors + AC + fan) as JSON to an MQTT broker every 5 seconds — useful for
dashboards or historians that prefer a push feed over polling.

| Env var       | Default                  |
| ------------- | ------------------------- |
| `MQTT_URL`    | `mqtt://localhost:1883`   |
| `MQTT_TOPIC`  | `funbyte/status`          |

If no broker is reachable at `MQTT_URL`, the client retries in the background;
the REST API is unaffected.

## Curl Examples

```bash
curl http://localhost:6677/api/status

curl -X POST http://localhost:6677/api/ac/on

curl -X POST http://localhost:6677/api/ac/off

curl -X POST \
  http://localhost:6677/api/ac/setpoint \
  -H "Content-Type: application/json" \
  -d '{"setpoint":22}'

curl -X POST http://localhost:6677/api/fan/on

curl -X POST http://localhost:6677/api/fan/off

curl http://localhost:6677/metrics
```

## Thermodynamic Model

Every second, the simulator updates an internal room state using a simplified
first-order model:

```text
temperature += heatGain + coolingEffect + occupancyHeat
humidity    += humidityGain + dehumidification + occupancyHumidity
co2         += co2Gain + occupancyCo2 + ventilationEffect
```

- **Heat/humidity/CO2 gain from outside** — the room drifts toward fixed
  outdoor conditions (34°C / 75%RH / 420ppm) proportional to the gap:
  `(outsideValue - roomValue) * 0.002`
- **Occupancy effects** — human activity adds heat, moisture, and CO2: low
  (0.001 heat / 0.002 humidity / -0.1 co2), medium (0.003 / 0.004 / 0.8), high
  (0.006 / 0.008 / 1.5)
- **AC cooling effect** (when powered on) — proportional to how far room
  temperature is above setpoint: `-max(0, roomTemp - setpoint) * 0.01`
- **AC dehumidification** (when powered on) — base `-0.02`, plus extra under
  high cooling load: `-max(0, delta) * 0.002`
- **Ventilation fan effect** (when powered on) — pulls CO2 toward the outdoor
  baseline faster: `(outdoorCo2 - roomCo2) * 0.02`
- All values are clamped to realistic bounds: 18-40°C, 30-90%RH, 400-5000ppm

Sensor readings are never the raw internal state — each read adds independent
random noise (±0.2°C for temperature sensors, ±1%RH for humidity sensors,
±15ppm for the CO2 sensor, ±0.05kW for the power meter) and rounds to
whole/one-decimal precision, so sensor pairs never report identical values.

### Power Draw

Unlike temperature/humidity/CO2, power isn't accumulated room state — it's
computed fresh on every read from current actuator state, so it's unaffected
by restarts:

```text
powerKw = baseLoad
        + (ac.power ? acBase + max(0, roomTemp - setpoint) * acLoadPerDegree + (30 - setpoint) * acSetpointPenalty : 0)
        + (fan.power ? fanLoad : 0)
```

- **Base load** — 0.3kW, always drawn (lighting/equipment baseline)
- **AC** (dominant contributor) — 1.2kW base while on, plus 0.15kW per degree
  of active cooling load, plus 0.05kW per degree the setpoint sits below the
  30°C ceiling (colder setpoint = harder-working compressor = more power)
- **Ventilation fan** — flat 0.3kW while on

## Black-Box Design

The internal room state (`temperature`, `humidity`, `co2`) is a private field
inside `OfficeSimulator` and is never returned by any route. External clients
can only observe:

- Noisy sensor readings (`temperatureA/B`, `humidityA/B`, `co2`, `powerKw`, `activity`)
- Actuator state (AC: `power`, `setpoint`, `mode`; fan: `power`)

This mirrors a real HVAC test environment: you control and observe equipment
through sensors and actuators, not by inspecting ground truth directly. The
simulation loop (`setInterval`, every 1000ms) keeps running continuously
regardless of whether any API requests come in, so state evolves realistically
even between polls.

## Notes

- State is kept entirely in memory — no database, no persistence across restarts.
- No authentication, no WebSocket, no automation/control logic (PID, scheduling,
  occupancy control, AI control) is implemented — this is intentionally a bare
  simulated plant for external systems to test against.
- MQTT publishing requires a reachable broker (see [MQTT Publishing](#mqtt-publishing));
  the REST API and `/metrics` work standalone with no broker.
