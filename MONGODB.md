# MongoDB setup

Set these backend-only variables in .env and in your backend hosting dashboard:

```dotenv
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=barbershop
```

Create an Atlas cluster, a database user with read/write access to barbershop, and allow network access from the backend and your local computer. Copy the URI from Connect > Drivers > Node.js. URL-encode special characters in credentials. Never expose the URI through a VITE_ variable or frontend settings.

To preserve existing data, stop the backend and run `npm run db:migrate` BEFORE starting the site with MongoDB. This imports server/data/store.json and admin.json (or the files in DATA_DIR), including the password hash, in one transaction. Source files stay intact. The import refuses to overwrite an initialized database; use a new empty database if you initialized one prematurely.

Then run `npm run dev` locally or `npm start` on the backend host. An imported administrator password continues to work. For an empty database, configure ADMIN_PASSWORD (15–128 characters) before startup or run `npm run admin:setup`. Remove ADMIN_PASSWORD from hosting settings after initialization. Verify health, login, booking creation and persistence after restarting. Redeploy the backend to switch the live website.

The backend selects MongoDB when MONGODB_URI is configured; without it, legacy JSON storage remains active. Connection failure stops startup rather than falling back to JSON. MongoDB Atlas or a self-hosted replica set is required for transactions; standalone servers are rejected.

Data lives in the site_records collection, with individual booking and gallery-image documents. Concurrent writes check a shared revision. Stale requests receive HTTP 409 and should refresh/retry instead of overwriting data or double booking.

Continue running one backend replica because sessions, password reset tokens and rate limits remain in memory. MongoDB needs no persistent local disk. DATA_DIR and BACKUP_DIR apply to legacy JSON storage and migration. Existing origin, proxy and email configuration still applies.

Use Atlas backups or mongodump/mongorestore for MongoDB. JSON backup commands refuse to run in MongoDB mode to avoid backing up stale files by mistake.

Run `npm test` and `npm run build`. Set MONGODB_TEST_URI to a separate test replica set to run the integration test; it creates and removes only a randomly named barbershop_test_* database.

References: [Atlas connections](https://www.mongodb.com/docs/atlas/connect-to-your-cluster/) and [Node driver transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).
