import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './index.js';
import { hashPassword, verifyPassword } from './auth.js';

const password = 'Test-only long password 927!';
const credential = await hashPassword(password);
async function fixture(t, configured = true, secure = false, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'tj-auth-'));
  if (configured) await writeFile(join(directory, 'admin.json'), JSON.stringify(credential));
  let clock = Date.now();
  const app = createApp({ dataDir: directory, origin: 'http://localhost:5173', now: () => clock, secure, ...options });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const request = (path, { method = 'GET', body, cookie, origin = 'http://localhost:5173', headers = {} } = {}) => fetch(`http://127.0.0.1:${app.address().port}/api${path}`, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const login = async () => {
    const response = await request('/auth/login', { method: 'POST', body: { password } });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie');
  };
  return { request, login, directory, advance: amount => { clock += amount; } };
}

test('email recovery validates links, expires them, persists passwords and revokes sessions', async t => {
  const messages = [];
  const { request, login, directory, advance } = await fixture(t, true, false, {
    adminEmail: 'owner@example.com', sendResetEmail: async message => messages.push(message),
  });
  const cookie = await login();
  const post = (path, body) => request('/auth/' + path, { method: 'POST', body });
  const unknown = await (await post('forgot-password', { email: 'other@example.com' })).json();
  assert.equal(messages.length, 0);
  const known = await (await post('forgot-password', { email: ' OWNER@example.com ' })).json();
  assert.deepEqual(unknown, known);
  assert.equal(messages.length, 1);
  const token = new URLSearchParams(new URL(messages[0].link).hash.split('?')[1]).get('reset');
  const newPassword = 'My replacement password 123!';
  const body = { token, newPassword, confirmPassword: newPassword };
  assert.equal((await post('reset-password', { ...body, token: 'a'.repeat(64) })).status, 400);
  assert.equal((await post('reset-password', { ...body, confirmPassword: 'different' })).status, 400);
  assert.equal((await post('reset-password', { ...body, newPassword: 'short', confirmPassword: 'short' })).status, 400);
  const results = await Promise.all([post('reset-password', body), post('reset-password', body)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await post('reset-password', body)).status, 400);
  assert.equal((await (await request('/auth/session', { cookie })).json()).authenticated, false);
  assert.equal(await verifyPassword(newPassword, JSON.parse(await readFile(join(directory, 'admin.json'), 'utf8'))), true);
  assert.equal((await post('login', { password })).status, 401);
  assert.equal((await post('login', { password: newPassword })).status, 200);
  await post('forgot-password', { email: 'owner@example.com' });
  const expired = new URLSearchParams(new URL(messages.at(-1).link).hash.split('?')[1]).get('reset');
  advance(15 * 60 * 1000);
  assert.equal((await post('reset-password', { ...body, token: expired })).status, 400);
});

test('email recovery handles missing configuration, delivery failure and request limits', async t => {
  const { request } = await fixture(t, true, false, { adminEmail: '', sendResetEmail: null });
  assert.equal((await request('/auth/forgot-password', { method: 'POST', body: { email: 'owner@example.com' } })).status, 503);
  const other = await fixture(t, true, false, { adminEmail: 'owner@example.com', sendResetEmail: async () => { throw new Error('offline'); } });
  const ask = () => other.request('/auth/forgot-password', { method: 'POST', body: { email: 'owner@example.com' } });
  for (let i = 0; i < 5; i++) assert.equal((await ask()).status, 200);
  assert.equal((await ask()).status, 429);
});

test('gallery changes require admin, validate uploads, persist edits and allow an empty gallery', async t => {
  const { request, login, directory } = await fixture(t);
  const initial = await (await request('/gallery')).json();
  assert.equal(initial.length, 6);
  const image = 'data:image/jpeg;base64,/9j/2Q==';
  const body = { action: 'save', caption: 'Fresh fade', src: image };
  assert.equal((await request('/gallery', { method: 'POST', body })).status, 401);
  assert.equal((await request('/gallery', { method: 'POST', body: { action: 'delete', id: initial[0].id } })).status, 401);
  const cookie = await login();
  assert.equal((await request('/gallery', { method: 'POST', cookie, body, origin: 'https://other.example' })).status, 403);
  for (const src of ['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,AAAA']) {
    assert.equal((await request('/gallery', { method: 'POST', cookie, body: { ...body, src } })).status, 400);
  }
  assert.equal((await request('/gallery', { method: 'POST', cookie, body: { ...body, caption: ' ' } })).status, 400);
  let response = await request('/gallery', { method: 'POST', cookie, body });
  assert.equal(response.status, 200);
  let items = await response.json();
  const added = items.at(-1);
  assert.equal(items.length, 7);
  const replacement = 'data:image/jpeg;base64,/9j/AA==';
  response = await request('/gallery', { method: 'POST', cookie, body: { action: 'save', ...added, caption: 'Updated fade', src: replacement } });
  assert.equal(response.status, 200);
  items = await response.json();
  assert.equal(items.at(-1).src, replacement);
  assert.equal(items.at(-1).caption, 'Updated fade');
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'store.json'), 'utf8')).gallery, items);
  assert.deepEqual(await (await request('/gallery')).json(), items);
  for (const item of items) {
    assert.equal((await request('/gallery', { method: 'POST', cookie, body: { action: 'delete', id: item.id } })).status, 200);
  }
  assert.deepEqual(await (await request('/gallery')).json(), []);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'store.json'), 'utf8')).gallery, []);
});

test('salted password hashing rejects short passwords and verifies safely', async () => {
  await assert.rejects(hashPassword('0205'));
  assert.notEqual((await hashPassword(password)).hash, credential.hash);
  assert.equal(await verifyPassword(password, credential), true);
  assert.equal(await verifyPassword('wrong', credential), false);
  assert.equal(await verifyPassword({}, credential), false);
});

test('admin password changes verify credentials, persist hashes, and revoke old sessions', async t => {
  const { request, login, directory } = await fixture(t);
  const newPassword = 'Replacement password 938!';
  const body = { currentPassword: password, newPassword, confirmPassword: newPassword };
  assert.equal((await request('/auth/password', { method: 'POST', body })).status, 401);
  const cookie = await login();
  const otherCookie = await login();
  const change = overrides => request('/auth/password', { method: 'POST', cookie, body: { ...body, ...overrides } });
  assert.equal((await request('/auth/password', { method: 'POST', cookie, body, origin: 'https://other.example' })).status, 403);
  assert.equal((await change({ currentPassword: 'wrong' })).status, 400);
  assert.equal((await change({ newPassword: '1234', confirmPassword: '1234' })).status, 400);
  assert.equal((await change({ confirmPassword: 'different' })).status, 400);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'admin.json'), 'utf8')), credential);
  const response = await change({});
  assert.equal(response.status, 200);
  const nextCookie = response.headers.get('set-cookie');
  for (const stale of [cookie, otherCookie]) {
    assert.equal((await request('/storage?prefix=bookings:', { cookie: stale })).status, 401);
  }
  assert.equal((await request('/storage?prefix=bookings:', { cookie: nextCookie })).status, 200);
  const saved = JSON.parse(await readFile(join(directory, 'admin.json'), 'utf8'));
  assert.equal(await verifyPassword(newPassword, saved), true);
  assert.equal(await verifyPassword(password, saved), false);
  assert.equal(JSON.stringify(saved).includes(newPassword), false);
  assert.equal((await request('/auth/login', { method: 'POST', body: { password } })).status, 401);
  assert.equal((await request('/auth/login', { method: 'POST', body: { password: newPassword } })).status, 200);
});

test('admin password verification is rate limited', async t => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const body = { currentPassword: 'wrong', newPassword: 'Replacement password 938!', confirmPassword: 'Replacement password 938!' };
  for (let i = 0; i < 5; i++) assert.equal((await request('/auth/password', { method: 'POST', cookie, body })).status, 400);
  assert.equal((await request('/auth/password', { method: 'POST', cookie, body })).status, 429);
});

test('unconfigured admin fails closed and legacy PIN is rejected', async t => {
  const { request } = await fixture(t, false);
  assert.equal((await request('/auth/login', { method: 'POST', body: { password: '2580' } })).status, 503);
  assert.equal((await request('/storage?prefix=bookings:')).status, 401);
});

test('backend requires authentication for booking records and all admin writes', async t => {
  const { request, login } = await fixture(t);
  assert.equal((await request('/storage?key=settings')).status, 200);
  assert.equal((await request('/storage?key=bookings:secret')).status, 401);
  assert.equal((await request('/storage?prefix=bookings:')).status, 401);
  assert.equal((await request('/storage?prefix=bookings:', { cookie: 'admin_session=forged' })).status, 401);
  for (const key of ['settings', 'services', 'schedule', 'blocked:2027-01-03', 'bookings:fake']) {
    assert.equal((await request('/storage', { method: 'PUT', body: { key, value: {} } })).status, 401);
  }
  const cookie = await login();
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  assert.equal((await request('/storage?prefix=bookings:', { cookie })).status, 200);
  const settings = await (await request('/storage?key=settings')).json();
  assert.equal((await request('/storage', { method: 'PUT', cookie, body: { key: 'settings', value: { ...settings, name: 'Updated shop' } } })).status, 200);
  assert.equal((await (await request('/storage?key=settings')).json()).name, 'Updated shop');
  assert.equal((await request('/storage', { method: 'PUT', cookie, body: { key: '__proto__', value: {} } })).status, 400);
});

test('five login attempts cause a 15-minute block, including spoofed forwarding headers', async t => {
  const { request, advance } = await fixture(t);
  for (let i = 0; i < 5; i++) {
    assert.equal((await request('/auth/login', { method: 'POST', body: { password: '2580' }, headers: { 'X-Forwarded-For': `192.0.2.${i}` } })).status, 401);
  }
  const blocked = await request('/auth/login', { method: 'POST', body: { password } });
  assert.equal(blocked.status, 429); assert.equal(blocked.headers.get('retry-after'), '900');
  advance(15 * 60 * 1000 + 1);
  assert.equal((await request('/auth/login', { method: 'POST', body: { password } })).status, 200);
});

test('sessions expire, rotate and revoke on logout; production cookies are secure', async t => {
  const { request, login, advance } = await fixture(t, true, true);
  let cookie = await login();
  assert.match(cookie, /; Secure/);
  assert.equal((await (await request('/auth/session', { cookie })).json()).authenticated, true);
  const rotated = await request('/auth/login', { method: 'POST', cookie, body: { password } });
  assert.equal((await request('/storage?prefix=bookings:', { cookie })).status, 401);
  cookie = rotated.headers.get('set-cookie');
  assert.equal((await request('/auth/logout', { method: 'POST', cookie, body: {} })).status, 200);
  assert.equal((await request('/storage?prefix=bookings:', { cookie })).status, 401);
  cookie = await login();
  advance(8 * 60 * 60 * 1000 + 1);
  assert.equal((await request('/storage?prefix=bookings:', { cookie })).status, 401);
});

test('cross-origin and non-JSON mutations are rejected', async t => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  assert.equal((await request('/auth/logout', { method: 'POST', cookie, body: {}, origin: 'https://attacker.invalid' })).status, 403);
  assert.equal((await request('/auth/login', { method: 'POST', body: { password }, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('/auth/login', { method: 'POST', body: { password }, origin: '' })).status, 403);
});

test('customer booking preserves privacy, checks conflicts, and restricts cancellation', async t => {
  const { request } = await fixture(t);
  const future = new Date(); future.setDate(future.getDate() + 7);
  while (future.getDay() !== 0) future.setDate(future.getDate() + 1);
  const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  const body = { serviceId: 's1', date, time: '08:00', name: 'Customer', phone: '0972551954', price: 0, status: 'confirmed' };
  const results = await Promise.all([request('/bookings', { method: 'POST', body }), request('/bookings', { method: 'POST', body })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const booking = await results.find(r => r.status === 201).json();
  assert.equal(booking.price, 100); assert.equal(booking.status, 'pending');
  const availability = await (await request('/availability?date=' + date)).json();
  assert.deepEqual(availability, [{ start: 480, end: 510 }]);
  assert.equal((await request('/storage?key=bookings:' + booking.reference)).status, 401);
  assert.equal((await request('/bookings/lookup', { method: 'POST', body: { reference: booking.reference, phone: '00000000' } })).status, 404);
  assert.equal((await request('/bookings/cancel', { method: 'POST', body: { reference: booking.reference, phone: '00000000' } })).status, 404);
  const credentials = { reference: booking.reference, phone: body.phone };
  assert.equal((await request('/bookings/lookup', { method: 'POST', body: credentials })).status, 200);
  assert.equal((await request('/bookings/cancel', { method: 'POST', body: credentials })).status, 200);
  assert.deepEqual(await (await request('/availability?date=' + date)).json(), []);
});

test('booking locations are validated, persisted, and protected from public access', async t => {
  const { request, login, directory } = await fixture(t);
  const future = new Date(); future.setDate(future.getDate() + 7);
  while (future.getDay() !== 0) future.setDate(future.getDate() + 1);
  const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  const body = { serviceId: 's1', date, time: '09:00', name: 'Location customer', phone: '0972551954' };
  for (const location of [{ lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: '-15', lng: 28 }, {}, [], 'https://example.com', { lat: null, lng: 0 }]) {
    assert.equal((await request('/bookings', { method: 'POST', body: { ...body, location } })).status, 400);
  }
  const location = { lat: -15.4167, lng: 28.2833 };
  const response = await request('/bookings', { method: 'POST', body: { ...body, location: { ...location, url: 'javascript:alert(1)' } } });
  assert.equal(response.status, 201);
  const booking = await response.json();
  assert.deepEqual(booking.location, location);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'store.json'), 'utf8'))['bookings:' + booking.reference].location, location);
  assert.equal((await request('/storage?key=bookings:' + booking.reference)).status, 401);
  assert.deepEqual(await (await request('/availability?date=' + date)).json(), [{ start: 540, end: 570 }]);
  const cookie = await login();
  assert.deepEqual((await (await request('/storage?key=bookings:' + booking.reference, { cookie })).json()).location, location);
  const credentials = { reference: booking.reference, phone: body.phone };
  assert.deepEqual((await (await request('/bookings/lookup', { method: 'POST', body: credentials })).json()).location, location);
  const noPin = await request('/bookings', { method: 'POST', body: { ...body, time: '10:00' } });
  assert.equal(noPin.status, 201);
  assert.equal((await noPin.json()).location, null);
});

test('security headers protect production pages while allowing the location picker', async t => {
  const { request } = await fixture(t, true, true);
  for (const path of ['/auth/session', '/../']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal(response.headers.get('permissions-policy'), 'geolocation=(self), camera=(), microphone=()');
    assert.match(response.headers.get('content-security-policy'), /script-src 'self';/);
    assert.match(response.headers.get('content-security-policy'), /https:\/\/tile.openstreetmap.org/);
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    await response.arrayBuffer();
  }
  const font = await request('/../fonts/delight/Delight-SemiBold.woff2');
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
  await font.arrayBuffer();
  for (const path of ['/../assets/', '/../server/data/admin.json', '/../server/data/store.json']) {
    const response = await request(path);
    assert.equal(response.status, 404);
    await response.arrayBuffer();
  }
  assert.equal((await request('/../%ZZ')).status, 400);
  assert.equal((await request('/auth/session')).status, 200);
});

test('invalid calendar dates and executable settings links are rejected', async t => {
  const { request, login } = await fixture(t);
  assert.equal((await request('/availability?date=2030-02-30')).status, 400);
  assert.equal((await request('/availability?date=2030-13-01')).status, 400);
  const cookie = await login();
  const settings = await (await request('/storage?key=settings')).json();
  for (const mapsUrl of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com']) {
    assert.equal((await request('/storage', { method: 'PUT', cookie, body: { key: 'settings', value: { ...settings, mapsUrl } } })).status, 400);
  }
  assert.equal((await request('/storage', { method: 'PUT', cookie, body: { key: 'settings', value: settings } })).status, 200);
});

test('gallery metadata keeps individual images out of gateway JSON responses', async t => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const src = 'data:image/jpeg;base64,/9j/2Q==';
  const saved = await request('/gallery?metadata=1', { method: 'POST', cookie, body: { action: 'save', caption: 'Gateway image', src } });
  const item = (await saved.json()).at(-1);
  assert.match(item.src, /^\/api\/gallery\/image\/[a-f0-9]+$/);
  const photo = await request(item.src.slice(4));
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), Buffer.from(src.split(',')[1], 'base64'));
  const updated = await request('/gallery?metadata=1', { method: 'POST', cookie, body: { action: 'save', ...item, caption: 'Changed caption' } });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).at(-1).src, item.src);
  assert.equal((await (await request('/gallery')).json()).at(-1).src, src);
});
