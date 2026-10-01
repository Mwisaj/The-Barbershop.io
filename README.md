# TJ Barbershop

For MongoDB setup and migration, see [MONGODB.md](MONGODB.md). JSON storage, disk and backup instructions below apply only when `MONGODB_URI` is unset.

React/Vite frontend and Node.js 24 backend. Bookings, customer locations, services, settings and gallery data are stored on the backend, not in the browser.

## Local development

1. `npm ci`
2. `npm run admin:setup` only when creating/resetting your local administrator password. Save the generated password privately.
3. `npm run dev` starts the frontend and API together.

Booking dates and times are consistently interpreted as **Africa/Lusaka (CAT, UTC+2)**, including customers browsing in another timezone. The business timezone is intentionally fixed for this Zambia shop.

## Vercel frontend + Render or Railway backend

Follow [DEPLOYMENT.md](DEPLOYMENT.md). The frontend calls its own `/api` routes. A Vercel function forwards these requests to the backend using a private gateway secret and Vercel's client-IP header. Admin cookies remain on the frontend domain; CORS and third-party cookies are not required.

- `vercel.json`: frontend build, gateway function and browser security headers.
- `render.yaml`: one Node service with a persistent disk.
- `railway.json` / `Dockerfile`: one backend replica; attach a Railway volume as described in the guide.
- `.env.example`: required environment-variable names. The application reads hosting environment variables; it does not automatically load this example file.
- `npm run deploy:check -- https://your-frontend-domain`: read-only checks after deploying.

Production startup requires an explicit persistent `DATA_DIR`, HTTPS `APP_ORIGIN`, administrator credentials and a protected gateway or explicit trusted-proxy configuration. The backend health endpoint is `/api/health`; it returns 503 after a detected write/backup failure.

## Storage and recovery

The store uses atomic flushed JSON writes and an exclusive directory lock. **Run one backend instance.** A second writer or a restore while the server is running is rejected. After a forced crash, a stale lock can take about ten seconds to expire; let the hosting platform restart the process.

Automatic snapshots are created on startup, every six hours, and clean shutdown. Snapshots older than thirty days are pruned. Files include the store and admin password hash, are private, and have a checksum to detect corruption. Backups on the same disk protect against application mistakes, not loss of that disk. Enable provider volume backups and retain a private off-platform copy as described in the deployment guide.

```text
npm run backup
npm run backup:verify -- /absolute/path/to/backup.json
# Stop the backend before restoring:
npm run backup:restore -- /absolute/path/to/backup.json --confirm
```

A restore saves the existing store first. It restores the administrator hash included in the snapshot, so the associated password becomes active after restarting. Do not restore a backup supplied by an untrusted party. `DATA_DIR` and `BACKUP_DIR` must point to the intended storage paths for every command. Do not delete the data volume during a redeployment.

## Verification

```text
npm run build
npm test
npm audit
```

Tests cover authentication, authorization, CSRF, sessions, booking conflicts, location privacy, date/link validation, static-file handling, backup recovery and locking, proxy spoofing, gateway cookies, gallery metadata and cross-timezone consistency. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for evidence and remaining hosting checks.
