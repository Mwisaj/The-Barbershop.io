# Deployment: Vercel + Render or Railway

For MongoDB setup and migration, see [MONGODB.md](MONGODB.md). JSON storage, disk and backup instructions below apply only when `MONGODB_URI` is unset.

Use Vercel for React and choose **one** of Render or Railway for Node. These files prepare deployment; no hosting account, domain, disk, or service has been created by this task.

## 1. Preserve existing data first

Stop the current backend and make a private copy of `server/data/store.json` and `server/data/admin.json`. These contain bookings/customer locations and the administrator password hash. Keep them out of Git and out of the frontend deployment.

To retain your current bookings, copy both files into the backend's mounted `DATA_DIR` **before starting it for customers**. If a new service has already initialized, stop it before replacing its files. Ensure the backend service user can read/write them (Railway image user is UID 1000). Never overwrite newly received bookings with an older local copy. The local data files have not been modified by the preparation or tests.

## 2. Choose your public frontend origin and secrets

Reserve a stable Vercel project/domain, such as `https://your-shop.vercel.app`. Use exactly that origin, without a trailing slash or path, for `APP_ORIGIN` on both services. Production custom domains must replace that value on both services; redirect aliases to the canonical domain.

Create a random `PROXY_SECRET` of at least 32 characters in a password manager. Put the **same secret** in the backend and Vercel environments. Never prefix secrets with `VITE_`, put them in the browser, or commit them. A 32-byte random value represented as 64 hexadecimal characters is suitable.

For a new empty deployment, set a unique `ADMIN_PASSWORD` of 15–128 characters on the backend. The first start hashes it and writes `admin.json`; subsequent starts preserve existing credentials. Remove `ADMIN_PASSWORD` from the hosting environment after successful initial login. When migrating an existing `admin.json`, do not set it: continue using the existing administrator password.

## 3A. Render backend

Use `render.yaml` as a Blueprint, or create a Node web service with:

| Setting | Value |
| --- | --- |
| Node version | 24 |
| Build | `npm ci` |
| Start | `npm start` |
| Health path | `/api/health` |
| Instances | 1 |
| Persistent disk mount | `/var/data` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `DATA_DIR` | `/var/data/bookings` |
| `BACKUP_DIR` | `/var/data/backups` |
| `APP_ORIGIN` | Your exact Vercel frontend origin |
| `PROXY_SECRET` | The shared private secret |
| `ADMIN_PASSWORD` | First startup only, for a new store |

Render provides `PORT`. The blueprint requests a paid service because persistent disks require an eligible paid service. Review the plan in the dashboard before creating it. [Render persistent-disk documentation](https://render.com/docs/disks).

## 3B. Railway backend

Deploy the repository using the supplied Dockerfile/`railway.json`. Attach a **volume at `/var/data`** in the Railway dashboard; `railway.json` alone does not create it. Set the same environment variables as in the table above. Railway supplies `PORT`. Use **one replica**, and configure deployment draining/overlap so the previous instance releases the disk lock before the new one starts. A healthy existing writer intentionally prevents another writer from starting.

The container initializes the two mounted directories as root, then drops privileges to the `node` user before running the server. Migrated private files must be owned by UID/GID 1000 and have restricted permissions. The health endpoint is `/api/health`. [Railway volume documentation](https://docs.railway.com/volumes/reference).

Generate a public HTTPS backend domain. Browser users will access the Vercel frontend, not this backend URL. Direct backend requests (except the minimal health endpoint) are rejected without the gateway secret.

## 4. Vercel frontend and gateway

Import the same repository, select Vite, Node.js 24, build command `npm run build`, output `dist`. The supplied `api/[...path].js` is a Node function and must be deployed alongside the static frontend, not as static files alone.

Set these **server-only** Vercel variables for the Production environment:

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact public Vercel frontend origin |
| `BACKEND_ORIGIN` | Exact Render/Railway HTTPS origin, no trailing slash |
| `PROXY_SECRET` | Same secret as the backend |

Do not give untrusted preview deployments production credentials. Test previews against a separate staging backend and data volume with the preview's exact origin.

The gateway only forwards known API routes, rejects foreign mutation origins, replaces spoofed proxy identity headers, forwards session cookies, applies request limits, and does not cache API responses. Gallery images are fetched individually to keep each response small. Vercel's platform-provided `x-vercel-forwarded-for` identifies the customer. [Vercel request-header documentation](https://vercel.com/docs/headers/request-headers).

For a different hosting layout with a direct reverse proxy, `TRUSTED_PROXIES` accepts an explicit comma-separated IP/CIDR list. Leave it unset in this Vercel-gateway setup. Never trust all addresses or trust a client-supplied forwarding header without a configured proxy boundary.

## 5. Backups, monitoring and launch checks

1. Enable the provider's volume/disk snapshot backups and a private off-platform backup copy. Application snapshots run every six hours with thirty-day retention, but share the volume by default. Select provider retention appropriate to the number of bookings you can afford to lose.
2. Run `npm run backup` and `npm run backup:verify -- <file>` in the backend shell. Practice restoration into a **separate empty directory** before relying on backups. Do not perform the practice restore over live data.
3. Configure uptime monitoring against `/api/health`. Configure restart-on-failure and alerts for unhealthy service/backup failures; platform process logs should remain private. The health endpoint reports errors detected during writes/backups, not a guarantee against future disk failure.
4. From your computer run `npm run deploy:check -- https://your-frontend-domain`. Optionally set `BACKEND_ORIGIN` locally to verify that direct backend API access is blocked too. The command makes no bookings.
5. In staging, verify admin login/logout, a booking from a mobile phone, allowed and denied GPS permission, actual map tiles, saved admin map, WhatsApp handoff, and unchanged booking data after a backend restart/redeploy.
6. Keep hosting/package updates current. Set customer-data retention/deletion procedures. Use provider firewall/bot controls if public booking spam occurs; per-IP rate limits are not proof of customer identity.

## Known boundaries

- Persistent disk must actually be attached. An environment-variable path alone cannot make temporary storage persistent.
- JSON storage is intentionally single-instance. Autoscaling requires migration to shared transactional storage and shared sessions/rate limits.
- Actual public HTTPS, Vercel routing, provider volume ownership, off-platform backups and account settings can only be verified after your services/domains exist.
- Docker is not installed in the local workspace used for this preparation, so the image has not been built locally. The Node application, gateway handler, production frontend and isolated mobile-browser flow were tested locally.
