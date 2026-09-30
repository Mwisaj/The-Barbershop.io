import assert from 'node:assert/strict';

const supplied = process.argv[2];
if (!supplied) throw new Error('Usage: npm run deploy:check -- https://your-frontend-domain');
const origin = new URL(supplied);
if (origin.protocol !== 'https:' || origin.origin !== supplied) throw new Error('Provide the exact public HTTPS frontend origin, without a trailing slash.');
async function request(path, options = {}) {
  return fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30000), ...options });
}
const page = await request('/');
assert.equal(page.status, 200, 'Frontend must serve successfully without redirecting.');
assert.equal(page.headers.get('x-frame-options'), 'DENY');
assert.match(page.headers.get('strict-transport-security') || '', /max-age=/);
assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
assert.match(page.headers.get('permissions-policy') || '', /geolocation=\(self\)/);
await page.text();
const health = await request('/api/health');
assert.equal(health.status, 200, 'Backend health must pass through the gateway.');
assert.equal((await health.json()).status, 'ok');
const settings = await request('/api/storage?key=settings');
assert.equal(settings.status, 200, 'Gateway secret / backend origin configuration failed.');
assert.ok((await settings.json()).name);
const session = await request('/api/auth/session');
assert.equal(session.status, 200, 'Nested authentication route must reach the gateway.');
assert.match(session.headers.get('content-type') || '', /application\/json/, 'Authentication must return JSON, not a platform 404.');
await session.json();
assert.equal((await request('/api/storage?prefix=bookings:')).status, 401, 'Booking records must not be public.');
const csrf = await request('/api/auth/logout', { method: 'POST', headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' }, body: '{}' });
assert.equal(csrf.status, 403, 'Cross-origin mutations must be rejected.');
if (process.env.BACKEND_ORIGIN) {
  const direct = await fetch(new URL('/api/storage?key=settings', process.env.BACKEND_ORIGIN), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  assert.equal(direct.status, 403, 'Direct backend access must require the gateway secret.');
}
console.log('Public deployment checks passed. No bookings were created or changed.');
console.log('Still verify admin login/logout, GPS permissions, WhatsApp, and restart persistence in a staging browser.');
