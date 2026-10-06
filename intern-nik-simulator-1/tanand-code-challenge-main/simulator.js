'use strict';

/**
 * Office HVAC black-box simulator.
 *
 * Internal room state (temperature/humidity) is never exposed directly.
 * External consumers only ever see sensor readings derived from that state.
 */

// ---- Fixed environment constants -----------------------------------------

const OUTDOOR = Object.freeze({
  temperature: 34,
  humidity: 75,
  co2: 420,
});

const LIMITS = Object.freeze({
  temperature: { min: 18, max: 40 },
  humidity: { min: 30, max: 90 },
  co2: { min: 400, max: 5000 },
  setpoint: { min: 18, max: 30 },
});

const ACTIVITY_LEVELS = Object.freeze(['low', 'medium', 'high']);
const ACTIVITY_WEIGHTS = Object.freeze({ low: 0.5, medium: 0.35, high: 0.15 });

// Heat / humidity / co2 contributed by occupants, keyed by activity level.
const OCCUPANCY_EFFECTS = Object.freeze({
  low: { heat: 0.001, humidity: 0.002, co2: -0.1 },
  medium: { heat: 0.003, humidity: 0.004, co2: 0.8 },
  high: { heat: 0.006, humidity: 0.008, co2: 1.5 },
});

// Power draw (kW), keyed by contributor. AC dominates: a base load plus more
// under heavier cooling load and lower (colder) setpoints. Fan is a flat add.
const POWER = Object.freeze({
  baseLoadKw: 0.3,
  acBaseKw: 1.2,
  acLoadPerDegreeKw: 0.15,
  acSetpointPenaltyKw: 0.05,
  fanKw: 0.3,
});

const SIMULATION_INTERVAL_MS = 1000;

// ---- Helpers ---------------------------------------------------------------

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function roundTo1(value) {
  return Math.round(value * 10) / 10;
}

function pickWeightedActivity() {
  const r = Math.random();
  let cumulative = 0;
  for (const level of ACTIVITY_LEVELS) {
    cumulative += ACTIVITY_WEIGHTS[level];
    if (r < cumulative) return level;
  }
  return ACTIVITY_LEVELS[ACTIVITY_LEVELS.length - 1];
}

function randomActivityIntervalMs() {
  // 5 to 15 minutes, in milliseconds.
  return randomInRange(5 * 60 * 1000, 15 * 60 * 1000);
}

// ---- Simulator --------------------------------------------------------------

class OfficeSimulator {
  constructor() {
    // Internal room state - NEVER exposed via API directly.
    this._room = {
      temperature: 30.0,
      humidity: 65.0,
      co2: 420,
    };

    // Actuator state.
    this.airConditioner = {
      power: true,
      setpoint: 24,
      mode: 'cool',
    };

    this.ventilationFan = {
      power: false,
    };

    // Human activity sensor state.
    this._activity = pickWeightedActivity();
    this._nextActivityChangeAt = Date.now() + randomActivityIntervalMs();

    this._timer = null;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), SIMULATION_INTERVAL_MS);
    // Do not keep the process alive solely because of this timer in test contexts.
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _maybeChangeActivity() {
    if (Date.now() >= this._nextActivityChangeAt) {
      this._activity = pickWeightedActivity();
      this._nextActivityChangeAt = Date.now() + randomActivityIntervalMs();
    }
  }

  _tick() {
    this._maybeChangeActivity();

    const room = this._room;
    const ac = this.airConditioner;

    // Drift toward outdoor conditions.
    const heatGain = (OUTDOOR.temperature - room.temperature) * 0.002;
    const humidityGain = (OUTDOOR.humidity - room.humidity) * 0.002;
    const co2Gain = (OUTDOOR.co2 - room.co2) * 0.002;

    // Occupancy contribution.
    const occupancy = OCCUPANCY_EFFECTS[this._activity];

    // AC effect.
    let coolingEffect = 0;
    let dehumidification = 0;
    if (ac.power) {
      const delta = room.temperature - ac.setpoint;
      coolingEffect = -Math.max(0, delta) * 0.01;
      dehumidification = -0.02 - Math.max(0, delta) * 0.002;
    }

    room.temperature += heatGain + coolingEffect + occupancy.heat;
    room.humidity += humidityGain + dehumidification + occupancy.humidity;
    // Ventilation fan pulls fresh outdoor air in, lowering CO2 faster.
    const ventilationEffect = this.ventilationFan.power ? (OUTDOOR.co2 - room.co2) * 0.02 : 0;

    room.co2 += co2Gain + occupancy.co2 + ventilationEffect;

    room.temperature = clamp(room.temperature, LIMITS.temperature.min, LIMITS.temperature.max);
    room.humidity = clamp(room.humidity, LIMITS.humidity.min, LIMITS.humidity.max);
    room.co2 = clamp(room.co2, LIMITS.co2.min, LIMITS.co2.max);
  }

  /**
   * Returns externally visible sensor readings, derived from internal state
   * with independent measurement noise per sensor.
   */
  getSensorReadings() {
    const room = this._room;
    const ac = this.airConditioner;

    let powerKw = POWER.baseLoadKw;
    if (ac.power) {
      const delta = Math.max(0, room.temperature - ac.setpoint);
      const setpointPenalty = LIMITS.setpoint.max - ac.setpoint;
      powerKw += POWER.acBaseKw + delta * POWER.acLoadPerDegreeKw + setpointPenalty * POWER.acSetpointPenaltyKw;
    }
    if (this.ventilationFan.power) {
      powerKw += POWER.fanKw;
    }

    return {
      temperatureA: roundTo1(room.temperature + randomInRange(-0.2, 0.2)),
      temperatureB: roundTo1(room.temperature + randomInRange(-0.2, 0.2)),
      humidityA: roundTo1(clamp(room.humidity + randomInRange(-1, 1), LIMITS.humidity.min, LIMITS.humidity.max)),
      humidityB: roundTo1(clamp(room.humidity + randomInRange(-1, 1), LIMITS.humidity.min, LIMITS.humidity.max)),
      co2: Math.round(clamp(room.co2 + randomInRange(-15, 15), LIMITS.co2.min, LIMITS.co2.max)),
      powerKw: Math.max(0, roundTo1(powerKw + randomInRange(-0.05, 0.05))),
      activity: this._activity,
    };
  }

  getAcStatus() {
    return { ...this.airConditioner };
  }

  turnAcOn() {
    this.airConditioner.power = true;
    return this.getAcStatus();
  }

  turnAcOff() {
    this.airConditioner.power = false;
    return this.getAcStatus();
  }

  setAcSetpoint(setpoint) {
    if (
      typeof setpoint !== 'number' ||
      !Number.isFinite(setpoint) ||
      setpoint < LIMITS.setpoint.min ||
      setpoint > LIMITS.setpoint.max
    ) {
      const err = new Error(`Setpoint must be between ${LIMITS.setpoint.min} and ${LIMITS.setpoint.max}`);
      err.statusCode = 400;
      throw err;
    }
    this.airConditioner.setpoint = setpoint;
    return this.getAcStatus();
  }

  getFanStatus() {
    return { ...this.ventilationFan };
  }

  turnFanOn() {
    this.ventilationFan.power = true;
    return this.getFanStatus();
  }

  turnFanOff() {
    this.ventilationFan.power = false;
    return this.getFanStatus();
  }

  getStatus() {
    return {
      sensors: this.getSensorReadings(),
      airConditioner: this.getAcStatus(),
      ventilationFan: this.getFanStatus(),
    };
  }
}

module.exports = { OfficeSimulator, LIMITS, OUTDOOR };
