export function isValidLocation(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90
    && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180;
}

export function locationUrl(value) {
  return isValidLocation(value)
    ? `https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`
    : '';
}
