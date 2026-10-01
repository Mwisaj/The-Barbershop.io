import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { openMongoStore } from './mongoStore.js';
import { createApp } from './index.js';
import { hashPassword, verifyPassword } from './auth.js';
import { DEFAULT_SETTINGS, DEFAULT_SERVICES, DEFAULT_SCHEDULE } from '../src/config/defaults.js';
import { getUpcomingDates } from '../src/lib/dateTime.js';

test('MongoDB HTTP writes wait for acknowledgement and failed writes never report success', async t => {
  let releaseWrite;
  let startedWrite;
  const started = new Promise(resolve => { startedWrite = resolve; });
  const pending = new Promise((resolve, reject) => { releaseWrite = reject; });
  const mongoStore = {
    read: async () => ({ value: { settings: DEFAULT_SETTINGS, services: DEFAULT_SERVICES, schedule: DEFAULT_SCHEDULE }, credential: null, credentialRevision: 0, revision: 0 }),
    persist: () => { startedWrite(); return pending; },
    checkHealth: async () => false,
    close: async () => {},
  };
  const app = createApp({ mongoStore });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.close(resolve)); await app.storageClosed; });
  const base = `http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(base + '/api/health')).status, 503);
  let finished = false;
  const response = fetch(base + '/api/bookings', {
    method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ serviceId: 's1', date: getUpcomingDates([0], 2)[1], time: '10:00', name: 'Test', phone: '0972551954' }),
  }).then(value => { finished = true; return value; });
  await started;
  assert.equal(finished, false);
  releaseWrite(new Error('Database unavailable'));
  const result = await response;
  assert.equal(result.status, 500);
  assert.deepEqual(await result.json(), { error: 'Server error. Please try again.' });
});

test('MongoDB import, restart, conflicts, large gallery and HTTP authentication', { skip: !process.env.MONGODB_TEST_URI }, async t => {
  const uri = process.env.MONGODB_TEST_URI;
  const database = 'barbershop_test_' + randomBytes(8).toString('hex');
  const stores = [];
  let app;
  t.after(async () => {
    if (app) { await new Promise(resolve => app.close(resolve)); await app.storageClosed; }
    for (const store of stores) await store.close();
    const cleanup = new MongoClient(uri);
    try { await cleanup.connect(); await cleanup.db(database).dropDatabase(); }
    finally { await cleanup.close(); }
  });
  const open = async () => { const store = await openMongoStore({ uri, database }); stores.push(store); return store; };
  const first = await open();
  const password = 'Mongo-test-password-long-832!';
  const credential = await hashPassword(password);
  const initial = { settings: DEFAULT_SETTINGS, services: DEFAULT_SERVICES, schedule: DEFAULT_SCHEDULE, 'bookings:imported': { name: 'Existing customer', location: { lat: -15, lng: 28 } } };
  await first.initialize(initial, credential, { importOnly: true });
  await assert.rejects(first.initialize(initial, credential, { importOnly: true }), /already contains/);
  assert.deepEqual((await first.read()).value, initial);
  const second = await open();
  const [a, b] = await Promise.all([first.read(), second.read()]);
  const results = await Promise.allSettled([
    first.persist({ ...a.value, 'bookings:a': { name: 'A' } }, a),
    second.persist({ ...b.value, 'bookings:b': { name: 'B' } }, b),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  const snapshot = await second.read();
  const gallery = Array.from({ length: 20 }, (_, id) => ({ id: String(id), caption: 'Image', src: 'x'.repeat(1000000) }));
  await second.persist({ ...snapshot.value, gallery }, snapshot);
  await first.close();
  const restarted = await open();
  assert.deepEqual((await restarted.read()).value.gallery, gallery);
  assert.deepEqual((await restarted.read()).value['bookings:imported'], initial['bookings:imported']);
  assert.equal(await restarted.checkHealth(), true);
  app = createApp({ mongoStore: restarted });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const request = (path, body, cookie) => fetch(`http://127.0.0.1:${app.address().port}/api${path}`, {
    method: body ? 'POST' : 'GET', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/storage?prefix=bookings:')).status, 401);
  const login = await request('/auth/login', { password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const nextPassword = password + 'new';
  assert.equal((await request('/auth/password', { currentPassword: password, newPassword: nextPassword, confirmPassword: nextPassword }, cookie)).status, 200);
  assert.equal(await verifyPassword(nextPassword, (await second.read()).credential), true);
  assert.equal((await request('/auth/login', { password })).status, 401);
  const body = { serviceId: 's1', date: getUpcomingDates([0], 2)[1], time: '10:00', name: 'Test customer', phone: '0972551954' };
  const bookings = await Promise.all([request('/bookings', body), request('/bookings', body)]);
  assert.deepEqual(bookings.map(result => result.status).sort(), [201, 409]);
  const booking = await bookings.find(result => result.status === 201).json();
  assert.equal((await second.read()).value['bookings:' + booking.reference].name, body.name);
});
