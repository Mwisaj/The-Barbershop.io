import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { resetEmailSender } from './resetEmail.js';
import { loadLocalEnv } from './loadEnv.js';
import { isIP } from 'node:net';
import { existsSync, mkdirSync, readFileSync, statSync, realpathSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPassword, hashPassword } from './auth.js';
import { openDataStore, atomicJson } from './dataStore.js';
import { clientIpResolver } from './clientIp.js';
import { isValidLocation } from '../src/lib/location.js';
import { validDate, validWebUrl } from './validation.js';
import { DEFAULT_SETTINGS, DEFAULT_SERVICES, DEFAULT_SCHEDULE, DEFAULT_GALLERY } from '../src/config/defaults.js';
import { timeToMinutes, rangesOverlap, generateSlots, appointmentTimestamp, calendarWeekday } from '../src/lib/dateTime.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const normalizePhone = value => String(value ?? '').replace(/\D/g, '');

export function createApp({ dataDir = fileURLToPath(new URL('./data/', import.meta.url)), backupDir, origin = 'http://localhost:5173', secure = false, now = Date.now, sessionMs = 8 * 60 * 60 * 1000, trustedProxies = [], proxySecret = '', adminEmail = process.env.ADMIN_EMAIL || '', sendResetEmail = resetEmailSender() } = {}) {
  const resolveIp = clientIpResolver(trustedProxies);
  if (proxySecret && proxySecret.length < 32) throw new Error('PROXY_SECRET must contain at least 32 characters.');
  mkdirSync(dataDir, { recursive: true });
  const credentialsPath = resolve(dataDir, 'admin.json');
  let credential = existsSync(credentialsPath) ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : null;
  const store = openDataStore(dataDir, { settings: DEFAULT_SETTINGS, services: DEFAULT_SERVICES, schedule: DEFAULT_SCHEDULE }, { backupDir });
  let db = store.value;
  const sessions = new Map();
  const resets = new Map();
  const recoveryEmail = adminEmail.trim().toLowerCase();
  const attempts = new Map();
  let activePasswordChecks = 0;
  const persist = next => {
    store.persist(next);
    db = next;
  };
  const limit = (key, max) => {
    const timestamp = now();
    for (const [id, value] of attempts) if (value.until <= timestamp) attempts.delete(id);
    const entry = attempts.get(key) || { count: 0, until: timestamp + 15 * 60 * 1000 };
    if (entry.count >= max) fail(429, 'Too many attempts. Try again in 15 minutes.');
    entry.count++;
    attempts.set(key, entry);
  };
  const busy = date => [
    ...Object.entries(db).filter(([key, b]) => key.startsWith('bookings:') && b.date === date && b.status !== 'cancelled').map(([, b]) => ({ start: timeToMinutes(b.time), end: timeToMinutes(b.time) + b.durationMinutes })),
    ...(db['blocked:' + date] || []).map(time => ({ start: timeToMinutes(time), end: timeToMinutes(time) + db.schedule.slotMinutes })),
  ];
  const server = createServer({ requestTimeout: 30000, headersTimeout: 15000 }, async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, origin);
      const path = url.pathname;
      if (path === '/api/health' && req.method === 'GET') { send(store.healthy ? 200 : 503, { status: store.healthy ? 'ok' : 'unavailable' }); return; }
      let ip;
      if (proxySecret) {
        const provided = Buffer.from(String(req.headers['x-proxy-secret'] || ''));
        const expected = Buffer.from(proxySecret);
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) fail(403, 'Use the website to access this service.');
        ip = req.headers['x-client-ip'];
        if (typeof ip !== 'string' || !isIP(ip)) fail(400, 'Invalid client address.');
      } else ip = resolveIp(req);
      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET') fail(405, 'Method not allowed.');
        const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
        let decoded;
        try { decoded = decodeURIComponent(path === '/' ? '/index.html' : path); } catch { fail(400, 'Invalid path.'); }
        const file = resolve(root, '.' + decoded);
        if (!file.startsWith(root + sep)) fail(404, 'Not found.');
        if (!existsSync(file)) fail(404, 'Not found. Build the frontend first.');
        if (!statSync(file).isFile() || !realpathSync(file).startsWith(realpathSync(root) + sep)) fail(404, 'Not found.');
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.mp4': 'video/mp4' };
        const contents = readFileSync(file);
        res.setHeader('Cache-Control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
        res.end(contents); return;
      }
      if (!['GET', 'POST', 'PUT'].includes(req.method)) fail(405, 'Method not allowed.');
      let body = {};
      if (req.method !== 'GET') {
        if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Request origin denied.');
        if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'JSON required.');
        const chunks = [];
        let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > (path === '/api/gallery' ? 1500000 : 65536)) fail(413, 'Request too large.'); chunks.push(chunk); }
        const raw = Buffer.concat(chunks).toString('utf8');
        try { body = JSON.parse(raw); } catch { fail(400, 'Invalid JSON.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request.');
      }
      const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('admin_session='))?.slice(14);
      for (const [id, expiry] of sessions) if (expiry <= now()) sessions.delete(id);
      const authed = !!token && sessions.has(token);
      const requireAdmin = () => { if (!authed) fail(401, 'Please sign in again.'); };
      const cookie = (value, age) => `admin_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
      const galleryResult = items => url.searchParams.get('metadata') === '1'
        ? items.map(item => ({ ...item, src: item.src.startsWith('data:image/jpeg;base64,') ? `/api/gallery/image/${item.id}` : item.src })) : items;
      if (path.startsWith('/api/gallery/image/') && req.method === 'GET') {
        const item = (db.gallery ?? DEFAULT_GALLERY).find(entry => entry.id === path.slice('/api/gallery/image/'.length));
        if (!item?.src.startsWith('data:image/jpeg;base64,')) fail(404, 'Image not found.');
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
        res.end(Buffer.from(item.src.split(',')[1], 'base64')); return;
      }
      if (path === '/api/gallery') {
        const gallery = db.gallery ?? DEFAULT_GALLERY;
        if (req.method === 'GET') { send(200, galleryResult(gallery)); return; }
        requireAdmin();
        const { action, id, caption, src } = body;
        const existing = gallery.find(item => item.id === id);
        if (action === 'delete') {
          if (!existing) fail(404, 'Image not found.');
          const next = gallery.filter(item => item.id !== id);
          persist({ ...db, gallery: next }); send(200, galleryResult(next)); return;
        }
        if (action !== 'save' || !text(caption, 200)) fail(400, 'Enter an image caption (up to 200 characters).');
        if (id && !existing) fail(404, 'Image not found.');
        const unchanged = existing && (src === existing.src || src === `/api/gallery/image/${existing.id}`);
        if (!unchanged) {
          if (typeof src !== 'string' || src.length > 1400000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) fail(400, 'Upload a JPEG image up to 1 MB.');
          const bytes = Buffer.from(src.split(',')[1], 'base64');
          if (bytes.length > 1048576 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) fail(400, 'Invalid JPEG image.');
        }
        if (!existing && gallery.length >= 30) fail(400, 'The gallery can contain up to 30 images.');
        const item = { id: existing?.id ?? randomBytes(12).toString('hex'), caption: caption.trim(), src: unchanged ? existing.src : src };
        const next = existing ? gallery.map(entry => entry.id === id ? item : entry) : [...gallery, item];
        persist({ ...db, gallery: next }); send(200, galleryResult(next)); return;
      }
      if (path === '/api/auth/session' && req.method === 'GET') { send(200, { authenticated: authed }); return; }
      if (path === '/api/auth/forgot-password' && req.method === 'POST') {
        limit('reset-request:' + ip, 5);
        if (!recoveryEmail || !sendResetEmail) fail(503, 'Email recovery is not configured. Contact the site owner to restore access.');
        if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) fail(400, 'Enter a valid email address.');
        for (const [id, entry] of resets) if (entry.expires <= now()) resets.delete(id);
        if (body.email.trim().toLowerCase() === recoveryEmail && credential && resets.size < 3) {
          const secret = randomBytes(32).toString('hex');
          const digest = createHash('sha256').update(secret).digest('hex');
          const entry = { expires: now() + 15 * 60 * 1000, credential };
          resets.set(digest, entry);
          try {
            await sendResetEmail({ email: recoveryEmail, link: `${origin}/#admin?reset=${secret}` });
          } catch {
            resets.delete(digest);
            console.error('Password reset email delivery failed. Check mail service configuration.');
          }
        }
        send(200, { message: 'If that email matches the admin account, a reset link will arrive shortly. Check your spam folder. Links expire in 15 minutes.' }); return;
      }
      if (path === '/api/auth/reset-password' && req.method === 'POST') {
        limit('reset-submit:' + ip, 10);
        const { token: resetToken, newPassword, confirmPassword } = body;
        if (typeof resetToken !== 'string' || !/^[a-f0-9]{64}$/.test(resetToken)) fail(400, 'This reset link is invalid or expired. Request a new one.');
        const digest = createHash('sha256').update(resetToken).digest('hex');
        const entry = resets.get(digest);
        const valid = () => entry && resets.get(digest) === entry && entry.expires > now() && entry.credential === credential;
        if (!valid()) fail(400, 'This reset link is invalid or expired. Request a new one.');
        if (typeof newPassword !== 'string' || newPassword.length < 15 || newPassword.length > 128) fail(400, 'Use a password between 15 and 128 characters.');
        if (newPassword !== confirmPassword) fail(400, 'The new passwords do not match.');
        if (activePasswordChecks >= 4) fail(503, 'Password update is busy. Please try again shortly.');
        activePasswordChecks++;
        try {
          const nextCredential = await hashPassword(newPassword);
          if (!valid()) fail(400, 'This reset link is invalid or expired. Request a new one.');
          atomicJson(credentialsPath, nextCredential);
          credential = nextCredential;
          resets.clear(); sessions.clear();
          res.setHeader('Set-Cookie', cookie('', 0));
          send(200, { updated: true }); return;
        } finally { activePasswordChecks--; }
      }
      if (path === '/api/auth/login' && req.method === 'POST') {
        limit('login:' + ip, 5);
        if (!credential) fail(503, 'Admin access has not been configured.');
        if (activePasswordChecks >= 4) fail(503, 'Sign-in is busy. Please try again shortly.');
        let validPassword;
        const checkedCredential = credential;
        activePasswordChecks++;
        try { validPassword = await verifyPassword(body.password, checkedCredential); }
        finally { activePasswordChecks--; }
        if (!validPassword || credential !== checkedCredential) fail(401, 'Incorrect password.');
        if (token) sessions.delete(token);
        const nextToken = randomBytes(32).toString('hex');
        sessions.set(nextToken, now() + sessionMs);
        res.setHeader('Set-Cookie', cookie(nextToken, Math.floor(sessionMs / 1000)));
        send(200, { authenticated: true }); return;
      }
      if (path === '/api/auth/password' && req.method === 'POST') {
        requireAdmin();
        limit('password-change:' + ip, 5);
        const { currentPassword, newPassword, confirmPassword } = body;
        if (typeof newPassword !== 'string' || newPassword.length < 15 || newPassword.length > 128) fail(400, 'Use a password between 15 and 128 characters.');
        if (newPassword !== confirmPassword) fail(400, 'The new passwords do not match.');
        if (newPassword === currentPassword) fail(400, 'Choose a different password.');
        if (activePasswordChecks >= 4) fail(503, 'Password update is busy. Please try again shortly.');
        const checkedCredential = credential;
        activePasswordChecks++;
        try {
          if (!await verifyPassword(currentPassword, checkedCredential)) fail(400, 'Current password is incorrect.');
          const nextCredential = await hashPassword(newPassword);
          if (credential !== checkedCredential || !sessions.has(token) || sessions.get(token) <= now()) fail(401, 'Please sign in again.');
          atomicJson(credentialsPath, nextCredential);
          credential = nextCredential;
          resets.clear();
          sessions.clear();
          const nextToken = randomBytes(32).toString('hex');
          sessions.set(nextToken, now() + sessionMs);
          res.setHeader('Set-Cookie', cookie(nextToken, Math.floor(sessionMs / 1000)));
          send(200, { updated: true }); return;
        } finally { activePasswordChecks--; }
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        if (token) sessions.delete(token);
        res.setHeader('Set-Cookie', cookie('', 0)); send(200, { authenticated: false }); return;
      }
      if (path === '/api/storage' && req.method === 'GET') {
        if (url.searchParams.has('prefix')) { requireAdmin(); send(200, Object.keys(db).filter(k => k.startsWith(url.searchParams.get('prefix')))); return; }
        const key = url.searchParams.get('key');
        if (!['services', 'settings', 'schedule'].includes(key) && !/^blocked:\d{4}-\d{2}-\d{2}$/.test(key)) requireAdmin();
        send(200, Object.hasOwn(db, key) ? db[key] : null); return;
      }
      if (path === '/api/storage' && req.method === 'PUT') {
        requireAdmin();
        const { key, value } = body;
        let valid = false;
        if (key === 'services') valid = Array.isArray(value) && value.length <= 100 && value.every(s => s && text(s.id, 100) && text(s.name, 200) && Number.isInteger(s.duration) && s.duration > 0 && s.duration <= 1440 && Number.isFinite(s.price) && s.price >= 0);
        if (key === 'settings') valid = value && Object.keys(DEFAULT_SETTINGS).every(k => typeof value[k] === 'string' && value[k].length <= 4000)
          && ['mapsUrl', 'instagram', 'facebook', 'tiktok'].every(k => validWebUrl(value[k]));
        if (key === 'schedule') valid = value && Array.isArray(value.enabledDays) && value.enabledDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6) && timePattern.test(value.openTime) && timePattern.test(value.closeTime) && value.openTime < value.closeTime && Number.isInteger(value.slotMinutes) && value.slotMinutes > 0 && value.slotMinutes <= 1440;
        if (/^blocked:\d{4}-\d{2}-\d{2}$/.test(key)) valid = Array.isArray(value) && value.length <= 1440 && value.every(t => timePattern.test(t));
        if (typeof key === 'string' && key.startsWith('bookings:') && db[key] && ['pending', 'confirmed', 'completed', 'cancelled'].includes(value?.status)) {
          persist({ ...db, [key]: { ...db[key], status: value.status } }); send(200, { saved: true }); return;
        }
        if (!valid) fail(400, 'Invalid settings.');
        persist({ ...db, [key]: value }); send(200, { saved: true }); return;
      }
      if (path === '/api/availability' && req.method === 'GET') {
        const date = url.searchParams.get('date');
        if (!validDate(date)) fail(400, 'Invalid date.');
        send(200, busy(date)); return;
      }
      if (path === '/api/bookings' && req.method === 'POST') {
        limit('booking:' + ip, 20);
        const service = db.services.find(s => s.id === body.serviceId);
        const { date, time, name, phone, notes = '', location = null } = body;
        if (location !== null && !isValidLocation(location)) fail(400, 'Choose a valid location on the map.');
        if (!service || !validDate(date) || !timePattern.test(time) || !text(name, 200) || !text(phone, 40) || normalizePhone(phone).length < 7 || typeof notes !== 'string' || notes.length > 2000) fail(400, 'Check your booking details.');
        const appointment = appointmentTimestamp(date, time);
        if (!Number.isFinite(appointment) || appointment <= now() || !db.schedule.enabledDays.includes(calendarWeekday(date)) || !generateSlots(db.schedule.openTime, db.schedule.closeTime, db.schedule.slotMinutes).includes(time)) fail(400, 'Select an available future appointment.');
        const start = timeToMinutes(time), end = start + service.duration;
        if (end > timeToMinutes(db.schedule.closeTime) || busy(date).some(b => rangesOverlap(start, end, b.start, b.end))) fail(409, 'That time is no longer available. Choose another slot.');
        const reference = 'TJ-' + randomBytes(12).toString('hex').toUpperCase();
        const booking = { reference, serviceId: service.id, serviceName: service.name, durationMinutes: service.duration, price: service.price, date, time, name: name.trim(), phone: phone.trim(), notes: notes.trim(), status: 'pending', createdAt: new Date(now()).toISOString() };
        booking.location = location === null ? null : { lat: location.lat, lng: location.lng };
        persist({ ...db, ['bookings:' + reference]: booking }); send(201, booking); return;
      }
      if (['/api/bookings/lookup', '/api/bookings/cancel'].includes(path) && req.method === 'POST') {
        limit('lookup:' + ip, 20);
        const booking = db['bookings:' + String(body.reference).trim().toUpperCase()];
        if (!booking || !normalizePhone(body.phone) || normalizePhone(body.phone) !== normalizePhone(booking.phone)) fail(404, 'No matching booking found.');
        if (path.endsWith('/cancel')) {
          if (booking.status === 'completed') fail(409, 'Completed bookings cannot be cancelled.');
          const updated = { ...booking, status: 'cancelled' };
          persist({ ...db, ['bookings:' + booking.reference]: updated }); send(200, updated); return;
        }
        send(200, booking); return;
      }
      fail(404, 'Not found.');
    } catch (error) {
      if (error.status === 429) res.setHeader('Retry-After', '900');
      send(error.status || 500, { error: error.status ? error.message : 'Server error. Please try again.' });
    }
  });
  server.once('close', () => store.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv();
  const production = process.env.NODE_ENV === 'production';
  const configuredOrigin = new URL(process.env.APP_ORIGIN || 'http://localhost:5173');
  if (!['http:', 'https:'].includes(configuredOrigin.protocol) || configuredOrigin.username || configuredOrigin.password || configuredOrigin.pathname !== '/' || configuredOrigin.search || configuredOrigin.hash) throw new Error('APP_ORIGIN must be a website origin without a path or credentials.');
  const origin = configuredOrigin.origin;
  if (production && configuredOrigin.protocol !== 'https:') throw new Error('Set APP_ORIGIN to your public HTTPS origin.');
  const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : undefined;
  if (production && !dataDir) throw new Error('Set DATA_DIR to your mounted persistent disk.');
  const publicRoot = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
  const backupDir = process.env.BACKUP_DIR ? resolve(process.env.BACKUP_DIR) : undefined;
  for (const directory of [dataDir, backupDir].filter(Boolean)) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const actual = realpathSync(directory);
    if (actual === publicRoot || actual.startsWith(publicRoot + sep)) throw new Error('Data and backups must be outside the public build folder.');
  }
  const credentialPath = resolve(dataDir || fileURLToPath(new URL('./data/', import.meta.url)), 'admin.json');
  mkdirSync(resolve(credentialPath, '..'), { recursive: true, mode: 0o700 });
  if (!existsSync(credentialPath) && process.env.ADMIN_PASSWORD) atomicJson(credentialPath, await hashPassword(process.env.ADMIN_PASSWORD));
  delete process.env.ADMIN_PASSWORD;
  if (production && !existsSync(credentialPath)) throw new Error('Configure ADMIN_PASSWORD on first startup, or run admin:setup.');
  const proxySecret = process.env.PROXY_SECRET || '';
  const trustedProxies = (process.env.TRUSTED_PROXIES || '').split(',').map(value => value.trim()).filter(Boolean);
  if (production && !proxySecret && !trustedProxies.length) throw new Error('Configure PROXY_SECRET for the Vercel gateway or an explicit TRUSTED_PROXIES list.');
  const server = createApp({ origin, secure: production, dataDir, backupDir, proxySecret, trustedProxies });
  server.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => console.log('Backend listening on port ' + (process.env.PORT || 3001)));
  const stop = () => { server.close(); server.closeIdleConnections(); setTimeout(() => process.exit(1), 25000).unref(); };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
