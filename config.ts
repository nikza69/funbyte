// Shared by controller.ts (acts on these) and dashboard.ts (displays them).
export const TH = {
  co2Alert: 700, co2FanOn: 450, co2FanOff: 430, tempHot: 28, deadband: 0.5, minSwitchMs: 3 * 60 * 1000,
  targets: { low: 25, medium: 24, high: 23 } as Record<string, number>, hotOffset: 2, minSetpoint: 22,
};
