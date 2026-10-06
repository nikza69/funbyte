export const TZ = 'Asia/Kuala_Lumpur'
export const n = (x, d = 1) => (x == null || isNaN(x) ? '–' : (+x).toFixed(d))
export const sg = (x, d = 1) => (x == null || isNaN(x) ? '–' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d))
export const tm = (t) => (t ? new Date(t).toLocaleTimeString('en-GB', { timeZone: TZ }) : '–')
export const myd = (off = 0) => new Date(Date.now() + 8 * 36e5 + off * 864e5).toISOString().slice(0, 10) // YYYY-MM-DD in MYT
export const HRS = [...Array(24).keys()].map((h) => String(h).padStart(2, '0') + ':00')
