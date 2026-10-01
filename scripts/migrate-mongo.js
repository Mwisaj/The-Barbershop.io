import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import lockfile from 'proper-lockfile';
import { loadLocalEnv } from '../server/loadEnv.js';
import { openMongoStore } from '../server/mongoStore.js';
import { validateStore } from '../server/dataStore.js';

loadLocalEnv();
const directory = resolve(process.env.DATA_DIR || fileURLToPath(new URL('../server/data/', import.meta.url)));
// The existing backend must be stopped so the imported files are consistent.
let release;
let store;
try {
  release = lockfile.lockSync(directory, { stale: 10000 });
  const value = validateStore(JSON.parse(readFileSync(resolve(directory, 'store.json'), 'utf8')));
  const adminPath = resolve(directory, 'admin.json');
  const credential = existsSync(adminPath) ? JSON.parse(readFileSync(adminPath, 'utf8')) : null;
  if (credential && (!/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{128}$/.test(credential.hash))) throw new Error('Invalid admin credentials in source file.');
  store = await openMongoStore({ uri: process.env.MONGODB_URI, database: process.env.MONGODB_DB || 'barbershop' });
  await store.initialize(value, credential, { importOnly: true });
  console.log('Imported site data and admin credentials into MongoDB. Original JSON files were preserved.');
} catch (error) {
  console.error(error.code === 'ELOCKED' ? 'Stop the backend before importing its JSON data.' : 'Import failed. Check the source files, MongoDB connection and that the target database is empty.');
  process.exitCode = 1;
} finally {
  await store?.close();
  release?.();
}
