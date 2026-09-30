import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

export function loadLocalEnv() {
  try {
    // Existing hosting/terminal environment variables take precedence.
    loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
