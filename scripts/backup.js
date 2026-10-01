import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupData, readBackup, restoreData } from '../server/dataStore.js';
import { loadLocalEnv } from '../server/loadEnv.js';

loadLocalEnv();
if (process.env.MONGODB_URI) throw new Error('These backup commands are for JSON storage only. Use MongoDB Atlas backups or mongodump/mongorestore for MongoDB.');

const dataDir = resolve(process.env.DATA_DIR || fileURLToPath(new URL('../server/data/', import.meta.url)));
const backupDir = resolve(process.env.BACKUP_DIR || resolve(dataDir, 'backups'));
const [command = 'create', file, approval] = process.argv.slice(2);
if (command === 'create') {
  const result = backupData(dataDir, backupDir);
  if (!result) throw new Error('No store.json exists to back up.');
  console.log('Backup created:', result);
} else if (command === 'verify' && file) {
  readBackup(resolve(file));
  console.log('Backup structure and checksum verified.');
} else if (command === 'restore' && file && approval === '--confirm') {
  const safety = restoreData(resolve(file), dataDir, backupDir);
  console.log('Restored. Previous data backup:', safety || 'No previous data');
} else {
  throw new Error('Use: node scripts/backup.js create | verify <file> | restore <file> --confirm. Stop the server before restoring.');
}
