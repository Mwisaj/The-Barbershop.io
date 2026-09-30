export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHOP_TIME_ZONE = 'Africa/Lusaka';
export const SHOP_TIME_LABEL = 'Lusaka time (CAT, UTC+2)';
const shopDate = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// Zambia uses CAT (UTC+2) year-round. Never interpret a booking in device time.
export function appointmentTimestamp(date, time) {
  return Date.parse(`${date}T${time}:00+02:00`);
}

export function calendarWeekday(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isoDate(d) {
  const parts = Object.fromEntries(shopDate.formatToParts(d).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function friendlyDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: "long", day: "numeric", month: "long" });
}
// Generates upcoming bookable dates based on whichever weekdays are enabled.
// This is the piece that lets the shop switch on more days later with zero
// code changes -- it just reads schedule.enabledDays from storage.
export function getUpcomingDates(enabledDays, count = 6, horizonDays = 60, now = new Date()) {
  const out = [];
  const today = new Date(isoDate(now) + 'T00:00:00Z');
  for (let i = 0; i < horizonDays && out.length < count; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    if (enabledDays.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
export function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
export function generateSlots(open, close, interval) {
  const slots = [];
  if (typeof open !== "string" || typeof close !== "string" || !Number.isInteger(interval) || interval <= 0) return slots;
  const start = timeToMinutes(open);
  const end = timeToMinutes(close);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440 || start >= end) return slots;
  for (let t = start; t + interval <= end; t += interval) {
    slots.push(minutesToTime(t));
  }
  return slots;
}
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
export function makeReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "CC-";
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

/* ---------------------------------------------------------------------
   SHARED UI BITS
--------------------------------------------------------------------- */
