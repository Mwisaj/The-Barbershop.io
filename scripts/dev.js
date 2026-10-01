import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { createConfiguredApp } from '../server/index.js';
import { loadLocalEnv } from '../server/loadEnv.js';

loadLocalEnv();

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    host: { type: 'string' },
    open: { type: 'boolean' },
    strictPort: { type: 'boolean' },
  },
});
let client;
let api;
let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  api?.closeAllConnections();
  if (api?.listening) await new Promise(resolve => api.close(resolve));
  await api?.storageClosed;
  await client?.close();
}

process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });

try {
  client = await createServer({ server: {
    ...(values.port ? { port: Number(values.port) } : {}),
    ...(values.host ? { host: values.host } : {}),
    strictPort: values.strictPort ?? false,
    open: false,
  } });
  await client.listen();
  const origin = process.env.APP_ORIGIN
    || client.resolvedUrls.local[0]?.replace(/\/$/, '')
    || client.resolvedUrls.network[0]?.replace(/\/$/, '');
  if (!origin) throw new Error('Could not determine the frontend origin. Set APP_ORIGIN explicitly.');
  api = await createConfiguredApp({ origin });
  await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(3001, '127.0.0.1', resolve);
  });
  console.log('Backend ready at http://127.0.0.1:3001');
  client.printUrls();
  if (values.open) client.openBrowser();
} catch (error) {
  console.error(error.code === 'EADDRINUSE'
    ? 'Port 3001 is already in use. Stop the existing backend, or use npm run dev:client with it.'
    : `Development startup failed: ${error.message}`);
  await stop(1);
}
