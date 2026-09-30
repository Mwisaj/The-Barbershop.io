# Security and deployment review — updated 2026-09-22

Status: the identified application-level deployment issues have been addressed for a **Vercel frontend + one Render/Railway Node backend with persistent storage**. The repository is prepared for that deployment. Actual hosting accounts, domains, volume attachment, live HTTPS and off-platform backup settings still require configuration and verification; no production deployment was performed.

## Fixes completed

| Previous concern | Implemented change | Evidence |
| --- | --- | --- |
| Customers share a proxy rate limit | Protected Vercel gateway supplies platform client IP; backend requires shared secret and rejects spoofed/direct requests. Explicit trusted-proxy IP/CIDR support for alternative setups. Password hashing has a concurrency cap instead of a shared fifteen-minute global lockout. | Proxy spoofing, separate client budgets, and real gateway login/cookie tests |
| Temporary storage / data loss | Production requires `DATA_DIR`; provider configs specify persistent disk/volume paths. Atomic flushed writes and exclusive directory locking prevent competing writers. | Restart persistence and second-writer tests |
| No recoverable backup flow | Snapshots on startup, every six hours and clean shutdown; thirty-day retention; checksums; verification/restore commands; restore saves previous state and refuses an active writer. | Backup, corruption rejection and restore tests |
| Server/customer timezone disagreement | Booking instants, future-slot checks, calendar dates and admin date filters consistently use Africa/Lusaka (UTC+2). Booking UI and WhatsApp identify the timezone. | Identical results under UTC, Los Angeles, Tokyo and Lusaka process timezones |
| Separate frontend/backend login cookies | Same-origin Vercel API gateway forwards secure HttpOnly/SameSite cookies. Backend public access requires gateway authentication. | End-to-end gateway login, authorized read and logout tests |
| Missing live-check tooling | `/api/health`, graceful shutdown, startup checks, Vercel/Render/Railway configuration and read-only `deploy:check` script. | Local health and gateway tests; live execution pending public domain |
| Oversized hero GIF | Original animation transcoded into 648,593-byte MP4, with 70,602-byte poster and reduced-motion/data-saving fallback. Original GIF retained locally but not referenced by the production bundle. | Production build asset sizes and mobile browser run |
| Oversized gallery API response through Vercel | Gateway requests metadata; image bytes are served in separate requests; edits preserve existing images. | Gallery metadata/read/edit regression test |

## Verification completed

- All **19 automated tests passed**.
- Production frontend build passed; the 25,866,700-byte GIF is no longer in the build. Video transfer is about 97.5% smaller than the GIF, excluding the small poster.
- Mobile Chrome test against an isolated temporary database passed: booking from a Los Angeles browser timezone, geolocation pin, confirmation, WhatsApp message encoding/location, admin login, saved location map, and logout. No uncaught page errors or horizontal overflow in that flow.
- The browser test created no real customer bookings and changed no real credentials. Real public map tile delivery, device permission prompts and app handoff still need a deployed-phone check.
- Dependencies were audited after adding the locking/proxy libraries: zero reported vulnerabilities at review time.
- Docker is unavailable in this workspace; the Railway container has not been built locally. No Vercel or provider deployment was created.

## Existing security protections retained

Salted scrypt password hashing; constant-time comparison; cryptographic session tokens and booking references; HttpOnly/SameSite=Strict cookies with Secure in production; authenticated admin writes; origin checks on mutations; request limits and timeouts; protected booking/location records; server-authoritative pricing; security headers/CSP; unsafe-link/calendar-date validation; static-path containment; credential/data files excluded from frontend and version control.

## Remaining operator actions

Follow [DEPLOYMENT.md](DEPLOYMENT.md): choose a backend provider, attach the persistent volume, privately migrate existing data, configure matching frontend origin/gateway secrets, and enable provider backups plus an off-platform copy. Run the live read-only check and staging booking/restart checks once domains exist. Never enable multiple backend replicas with this JSON store.

Automatic snapshots on the same disk do not survive loss of that disk. Provider backup schedules, retention, monitoring and account access remain infrastructure responsibilities. Public bookings do not verify phone ownership; rate limiting reduces abuse but does not eliminate distributed fake bookings. This was a code review and regression validation, not a claim of perfect security or an exhaustive penetration test.

## References

- [OWASP HTTP headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Render persistent disks](https://render.com/docs/disks)
- [Railway volumes](https://docs.railway.com/volumes/reference)
