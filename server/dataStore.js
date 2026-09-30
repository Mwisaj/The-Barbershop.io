import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, statSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import lockfile from 'proper-lockfile';

export function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value), { mode: 0o600, flush: true });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function validateStore(store) {
  if (!store || !Array.isArray(store.services) || !store.settings || !store.schedule || !Array.isArray(store.schedule.enabledDays)) throw new Error('Invalid store backup.');
  return store;
}

export function backupData(dataDir, backupDir, now = new Date()) {
  const source = resolve(dataDir, 'store.json');
  if (!existsSync(source)) return null;
  const store = validateStore(JSON.parse(readFileSync(source, 'utf8')));
  const adminPath = resolve(dataDir, 'admin.json');
  const admin = existsSync(adminPath) ? JSON.parse(readFileSync(adminPath, 'utf8')) : null;
  const payload = { store, admin };
  const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const file = resolve(backupDir, `backup-${now.toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}.json`);
  atomicJson(file, { version: 1, createdAt: now.toISOString(), checksum, payload });
  return file;
}

export function readBackup(file) {
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  if (backup.version !== 1 || !backup.payload || createHash('sha256').update(JSON.stringify(backup.payload)).digest('hex') !== backup.checksum) throw new Error('Backup checksum mismatch.');
  validateStore(backup.payload.store);
  const admin = backup.payload.admin;
  if (admin && (!/^[a-f0-9]{32}$/.test(admin.salt) || !/^[a-f0-9]{128}$/.test(admin.hash))) throw new Error('Invalid admin credential in backup.');
  return backup.payload;
}

export function restoreData(file, dataDir, backupDir) {
  const payload = readBackup(file);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const release = lockfile.lockSync(dataDir, { stale: 10000 });
  try {
    const safetyBackup = backupData(dataDir, backupDir);
    atomicJson(resolve(dataDir, 'store.json'), payload.store);
    if (payload.admin) atomicJson(resolve(dataDir, 'admin.json'), payload.admin);
    return safetyBackup;
  } finally { release(); }
}

export function openDataStore(dataDir, defaults, { backupDir = resolve(dataDir, 'backups'), backupIntervalMs = 6 * 60 * 60 * 1000 } = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  if (!Number.isFinite(backupIntervalMs) || backupIntervalMs < 1000) throw new Error('Invalid backup interval.');
  const release = lockfile.lockSync(dataDir, { stale: 10000, update: 2000 });
  let timer;
  let state;
  let backupError = false;
  let writeError = false;
  const path = resolve(dataDir, 'store.json');
  function snapshot() {
    try {
      backupData(dataDir, backupDir);
      // Retain thirty days of automatic snapshots. Never touch unrelated files.
      const root = realpathSync(backupDir);
      for (const name of readdirSync(root)) {
        if (!/^backup-[\dTZ-]+-[a-f0-9]{8}\.json$/.test(name)) continue;
        const file = resolve(root, name);
        if (file.startsWith(root + sep) && statSync(file).isFile() && Date.now() - statSync(file).mtimeMs > 30 * 86400000) unlinkSync(file);
      }
      backupError = false;
    } catch (error) {
      backupError = true;
      console.error('Automatic backup failed:', error.code || 'BACKUP_ERROR');
    }
  }
  try {
    state = existsSync(path) ? validateStore(JSON.parse(readFileSync(path, 'utf8'))) : structuredClone(defaults);
    if (!existsSync(path)) atomicJson(path, state);
    snapshot();
    if (backupError) throw new Error('Cannot create a backup. Check BACKUP_DIR permissions.');
    timer = setInterval(snapshot, backupIntervalMs);
    timer.unref();
  } catch (error) { release(); throw error; }
  return {
    get value() { return state; },
    get healthy() { return !backupError && !writeError; },
    persist(next) {
      try { atomicJson(path, next); state = next; writeError = false; }
      catch (error) { writeError = true; throw error; }
    },
    close() { clearInterval(timer); snapshot(); release(); },
  };
}
