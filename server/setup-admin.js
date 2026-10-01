import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { hashPassword } from './auth.js';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from './loadEnv.js';
import { openMongoStore } from './mongoStore.js';
import { DEFAULT_SETTINGS, DEFAULT_SERVICES, DEFAULT_SCHEDULE } from '../src/config/defaults.js';

loadLocalEnv();
const directory = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : fileURLToPath(new URL('./data/', import.meta.url));
const password = randomBytes(24).toString('hex');
if (process.env.MONGODB_URI) {
  const store = await openMongoStore({ uri: process.env.MONGODB_URI, database: process.env.MONGODB_DB || 'barbershop' });
  try {
    await store.initialize({ settings: DEFAULT_SETTINGS, services: DEFAULT_SERVICES, schedule: DEFAULT_SCHEDULE });
    await store.saveCredential(await hashPassword(password), (await store.read()).credential);
  } finally { await store.close(); }
} else {
await mkdir(directory, { recursive: true });
await writeFile(join(directory, 'admin.json'), JSON.stringify(await hashPassword(password)), { mode: 0o600 });
}
console.log('New admin password (save in your password manager):\n' + password);
console.log('Restart the backend to invalidate existing sessions and load this password.');
