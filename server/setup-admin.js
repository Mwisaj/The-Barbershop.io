import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { hashPassword } from './auth.js';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : fileURLToPath(new URL('./data/', import.meta.url));
const password = randomBytes(24).toString('hex');
await mkdir(directory, { recursive: true });
await writeFile(join(directory, 'admin.json'), JSON.stringify(await hashPassword(password)), { mode: 0o600 });
console.log('New admin password (save in your password manager):\n' + password);
console.log('Restart the backend to invalidate existing sessions and load this password.');
