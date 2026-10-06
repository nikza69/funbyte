import mqtt from 'mqtt';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'funbyte/status';
const TARIFF_PER_KWH = Number(process.env.TARIFF_PER_KWH) || 0.365;
const TICK_INTERVAL_HOURS = 5 / 3600;

// InfluxDB Setup
const influx = new InfluxDB({
  url: process.env.INFLUX_URL || 'http://localhost:8086',
  token: process.env.INFLUX_TOKEN,
});

const writeApi = influx.getWriteApi(
  process.env.INFLUX_ORG || 'rand',
  process.env.INFLUX_BUCKET || 'rand',
  'ns'
);

// Types
interface SimulatorPayload {
  sensors: {
    temperatureA: number;
    temperatureB: number;
    humidityA: number;
    humidityB: number;
    co2: number;
    powerKw: number;
    activity: 'low' | 'medium' | 'high';
  };
  airConditioner: {
    power: boolean;
    setpoint: number;
    mode: string;
  };
  ventilationFan: {
    power: boolean;
  };
}

const activityToNumber: Record<string, number> = { low: 1, medium: 2, high: 3 };

// MQTT Engine
const mqttClient = mqtt.connect(MQTT_URL);

mqttClient.on('connect', () => {
  console.log(`Connected to MQTT broker at ${MQTT_URL}`);
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error('Subscription error:', err);
    else console.log(`Subscribed to ${MQTT_TOPIC}`);
  });
});

mqttClient.on('message', async (_topic, message) => {
  try {
    const payload: SimulatorPayload = JSON.parse(message.toString());
    const { sensors, airConditioner, ventilationFan } = payload;

    const avgTemp = (sensors.temperatureA + sensors.temperatureB) / 2;
    const avgHumidity = (sensors.humidityA + sensors.humidityB) / 2;
    const energyKwhTick = sensors.powerKw * TICK_INTERVAL_HOURS;
    const costMyrTick = energyKwhTick * TARIFF_PER_KWH;
    const hourlyCostRate = sensors.powerKw * TARIFF_PER_KWH;

    // Send metrics to InfluxDB
    const point = new Point('office_telemetry')
      .tag('zone', 'main_office')
      .floatField('temperature_a', sensors.temperatureA)
      .floatField('temperature_b', sensors.temperatureB)
      .floatField('temperature_avg', avgTemp)
      .floatField('humidity_a', sensors.humidityA)
      .floatField('humidity_b', sensors.humidityB)
      .floatField('humidity_avg', avgHumidity)
      .floatField('co2', sensors.co2)
      .floatField('power_kw', sensors.powerKw)
      .floatField('energy_kwh_delta', energyKwhTick)
      .floatField('cost_myr_delta', costMyrTick)
      .floatField('cost_rate_myr_per_hr', hourlyCostRate)
      .intField('activity_level', activityToNumber[sensors.activity] || 1)
      .stringField('activity', sensors.activity)
      .booleanField('ac_power', airConditioner.power)
      .intField('ac_setpoint', airConditioner.setpoint)
      .booleanField('fan_power', ventilationFan.power)
      .intField('ac_on', airConditioner.power ? 1 : 0)
      .intField('fan_on', ventilationFan.power ? 1 : 0);

    writeApi.writePoint(point);
    await writeApi.flush();

    console.log(
      `Fan Stat: ${ventilationFan.power} | AC Stat:${airConditioner.power} | AC Temp:${airConditioner.setpoint} |Env Temp: ${avgTemp.toFixed(1)}°C | Env Hum: ${avgHumidity.toFixed(1)}% | Activity: ${sensors.activity} | CO2: ${sensors.co2}ppm | Power: ${sensors.powerKw}kW`
    );
  } catch (error) {
    console.error('Error processing MQTT message:', error);
  }

});