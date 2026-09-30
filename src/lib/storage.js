export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch('/api' + path, {
    method, credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('admin-session-expired'));
    throw Object.assign(new Error(result.error || 'Request failed.'), { status: response.status });
  }
  return result;
}
export async function storageGet(key, shared, fallback) {
  return (await api('/storage?key=' + encodeURIComponent(key))) ?? fallback;
}
export async function storageSet(key, value) {
  try {
    await api('/storage', { method: 'PUT', body: { key, value } });
    return true;
  } catch (error) {
    window.dispatchEvent(new CustomEvent('admin-save-error', { detail: error.message }));
    return false;
  }
}
export async function storageKeys(prefix) {
  return api('/storage?prefix=' + encodeURIComponent(prefix));
}