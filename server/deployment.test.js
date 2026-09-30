import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDataStore, backupData, readBackup, restoreData } from './dataStore.js';
import { clientIpResolver } from './clientIp.js';
import { createGateway } from './gateway.js';
import { createApp } from './index.js';
import { DEFAULT_SETTINGS, DEFAULT_SERVICES, DEFAULT_SCHEDULE } from '../src/config/defaults.js';

const defaults = { settings: DEFAULT_SETTINGS, services: DEFAULT_SERVICES, schedule: DEFAULT_SCHEDULE };
const secret = 'test-only-proxy-secret-with-at-least-32-characters';
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'tj-deployment-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('shop dates and appointment instants are identical across device/server timezones', () => {
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Africa/Lusaka']) {
    const code = `import { isoDate, appointmentTimestamp, getUpcomingDates, calendarWeekday } from './src/lib/dateTime.js'; console.log(JSON.stringify([isoDate(new Date('2026-09-26T22:30:00Z')), appointmentTimestamp('2026-09-27','08:00'), getUpcomingDates([0], 1, 60, new Date('2026-09-26T22:30:00Z')), calendarWeekday('2026-09-27')]));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ['2026-09-27', Date.parse('2026-09-27T06:00:00Z'), ['2026-09-27'], 0]);
  }
});

test('store survives restart, excludes a second writer, and backups restore without losing existing data silently', async t => {
  const root = await directory(t);
  const data = join(root, 'data'), backups = join(root, 'backups');
  let store = openDataStore(data, defaults, { backupDir: backups });
  t.after(() => { if (store) store.close(); });
  assert.throws(() => openDataStore(data, defaults, { backupDir: backups }), /lock/i);
  store.persist({ ...store.value, 'bookings:test': { name: 'Test customer', location: { lat: -15, lng: 28 } } });
  const backup = backupData(data, backups);
  assert.equal(readBackup(backup).store['bookings:test'].name, 'Test customer');
  assert.throws(() => restoreData(backup, data, backups), /lock/i);
  store.close(); store = null;
  store = openDataStore(data, defaults, { backupDir: backups });
  assert.equal(store.value['bookings:test'].location.lng, 28);
  store.persist({ ...defaults, marker: 'before-restore' });
  store.close(); store = null;
  const safety = restoreData(backup, data, backups);
  assert.equal(readBackup(safety).store.marker, 'before-restore');
  assert.equal(JSON.parse(await readFile(join(data, 'store.json')) )['bookings:test'].name, 'Test customer');
  const altered = JSON.parse(await readFile(backup)); altered.payload.store.settings.name = 'Tampered';
  const damaged = join(root, 'damaged.json'); await writeFile(damaged, JSON.stringify(altered));
  assert.throws(() => restoreData(damaged, data, backups), /checksum/);
});

test('proxy resolver ignores spoofed forwarding from untrusted peers', () => {
  const request = { socket: { remoteAddress: '203.0.113.9' }, headers: { 'x-forwarded-for': '198.51.100.8' } };
  assert.equal(clientIpResolver([])(request), '203.0.113.9');
  request.socket.remoteAddress = '127.0.0.1';
  assert.equal(clientIpResolver(['127.0.0.1'])(request), '198.51.100.8');
  request.headers['x-forwarded-for'] = '1.1.1.1, 198.51.100.8';
  assert.equal(clientIpResolver(['127.0.0.1'])(request), '198.51.100.8');
  assert.throws(() => clientIpResolver(['0.0.0.0/0']), /not allowed/);
});

test('gateway preserves cookie and origin, overwrites spoofed identity, and encodes gallery delivery as metadata', async () => {
  let seen;
  const gateway = createGateway({ backendOrigin: 'https://backend.example', appOrigin: 'https://shop.example', secret,
    fetchUpstream: async (url, options) => { seen = { url, ...options }; return new Response('{}', { headers: { 'set-cookie': 'admin_session=test; HttpOnly; Secure; SameSite=Strict; Path=/' } }); },
  });
  let response = await gateway(new Request('https://shop.example/api/auth/login', { method: 'POST', headers: { origin: 'https://shop.example', 'content-type': 'application/json', 'x-vercel-forwarded-for': '198.51.100.1', 'x-client-ip': '1.1.1.1', 'x-proxy-secret': 'fake' }, body: '{"password":"test"}' }));
  assert.equal(response.status, 200);
  assert.equal(seen.headers.get('x-client-ip'), '198.51.100.1');
  assert.equal(seen.headers.get('x-proxy-secret'), secret);
  assert.equal(seen.headers.get('origin'), 'https://shop.example');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  response = await gateway(new Request('https://shop.example/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json', 'x-vercel-forwarded-for': '198.51.100.1' }, body: '{}' }));
  assert.equal(response.status, 403);
  response = await gateway(new Request('https://shop.example/api/gallery', { headers: { 'x-vercel-forwarded-for': '198.51.100.1' } }));
  assert.equal(seen.url.searchParams.get('metadata'), '1');
  assert.equal((await gateway(new Request('https://shop.example/api/storage'))).status, 400);
  assert.equal((await gateway(new Request('https://shop.example/api/unknown', { headers: { 'x-vercel-forwarded-for': '198.51.100.1' } }))).status, 404);
});

test('protected backend requires gateway secret and rate limits each customer separately', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'tj-protected-'));
  const app = createApp({ dataDir, proxySecret: secret });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.close(resolve)); await rm(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/api/storage?key=settings')).status, 403);
  const request = ip => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-proxy-secret': secret, 'x-client-ip': ip }, body: '{"password":"test"}' });
  for (let i = 0; i < 5; i++) assert.equal((await request('198.51.100.1')).status, 503);
  assert.equal((await request('198.51.100.1')).status, 429);
  assert.equal((await request('198.51.100.2')).status, 503);
});

test('gateway passes real backend secure login cookies and permits authorized admin reads', async t => {
  const { hashPassword } = await import('./auth.js');
  const dataDir = await mkdtemp(join(tmpdir(), 'tj-gateway-'));
  const password = 'Gateway-test-long-password-92847';
  await writeFile(join(dataDir, 'admin.json'), JSON.stringify(await hashPassword(password)));
  const app = createApp({ dataDir, proxySecret: secret, origin: 'https://shop.example', secure: true });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.close(resolve)); await rm(dataDir, { recursive: true, force: true }); });
  const gateway = createGateway({ backendOrigin: 'https://backend.example', appOrigin: 'https://shop.example', secret,
    fetchUpstream: (url, options) => fetch(`http://127.0.0.1:${app.address().port}${url.pathname}${url.search}`, options),
  });
  const headers = { origin: 'https://shop.example', 'content-type': 'application/json', 'x-vercel-forwarded-for': '198.51.100.7' };
  const login = await gateway(new Request('https://shop.example/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ password }) }));
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800; Secure/);
  const read = await gateway(new Request('https://shop.example/api/storage?prefix=bookings:', { headers: { ...headers, cookie: cookie.split(';')[0] } }));
  assert.equal(read.status, 200);
  const logout = await gateway(new Request('https://shop.example/api/auth/logout', { method: 'POST', headers: { ...headers, cookie: cookie.split(';')[0] }, body: '{}' }));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
