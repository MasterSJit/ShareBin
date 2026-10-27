# Deployment

## 1. Build

```bash
bun install
cp .env.example .env        # set SESSION_SECRET, CRON_SECRET, APP_URL
bun run db:push
bun run db:seed             # first install only
bun run build               # standalone output in .next/standalone
bun run start               # NODE_ENV=production, port 3000
```

`bun run build` copies `public/` and `.next/static` into `.next/standalone`, so
that directory (plus `prisma/`, `storage/` and `.env`) is all a server needs.
Run it with `PORT=3000 node .next/standalone/server.js` if you prefer Node.

> If Next.js warns that it "inferred your workspace root" from a lockfile
> outside the project (for example `~/package-lock.json`), remove that stray
> lockfile. Otherwise standalone output can be nested under the wrong
> directory and the dev server may serve stale styles from its cache
> (delete `.next/dev` to recover).

## 2. Reverse proxy

Terminate TLS in a proxy and forward to port 3000. The proxy must overwrite
`X-Forwarded-For` (rate limits use it) and pass `X-Forwarded-Proto`/`Host` so
share links get the right scheme and host.

**Caddy** (a version of this ships as `Caddyfile`):

```caddy
paste.example.com {
	reverse_proxy localhost:3000 {
		header_up X-Forwarded-For {remote_host}
		header_up X-Real-IP {remote_host}
	}
	request_body {
		max_size 110MB   # largest plan upload + multipart overhead
	}
}
```

**nginx**:

```nginx
server {
    server_name paste.example.com;
    client_max_body_size 110m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Also set **Admin → Settings → SEO → canonical URL** (or `APP_URL`) to the
public URL — it is used for share links in API responses.

## 3. Scheduled jobs

```cron
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://paste.example.com/api/cron/cleanup > /dev/null
0 3 * * *    curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://paste.example.com/api/cron/subscriptions > /dev/null
```

Expired pastes are also removed when someone tries to open them and during
listing requests, so missing a run only delays the cleanup.

## 4. Process manager

systemd example:

```ini
[Unit]
Description=ShareBin
After=network.target

[Service]
WorkingDirectory=/srv/sharebin
EnvironmentFile=/srv/sharebin/.env
Environment=NODE_ENV=production PORT=3000
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
User=sharebin

[Install]
WantedBy=multi-user.target
```

Run a **single** instance (in-memory caches and rate limits; SQLite). See
[ARCHITECTURE.md → Scaling notes](ARCHITECTURE.md#scaling-notes) before
scaling out.

## 5. Health checks

`GET /api/health` → `200 {"status":"ok"}` or `503` when the database is
unreachable. Point your load balancer / uptime monitor at it.

## 6. Backups

Back up these together:

- the database file (`prisma/db/custom.db` with the default `DATABASE_URL`)
- the upload directory (`STORAGE_LOCAL_ROOT`, default `./storage`)
- `.env` (contains `SESSION_SECRET`; changing it signs everyone out)

For a consistent SQLite copy while the app runs:

```bash
sqlite3 prisma/db/custom.db ".backup 'backup-$(date +%F).db'"
```

## 7. Upgrading

```bash
git pull
bun install
cp prisma/db/custom.db prisma/db/custom.db.bak
bun run db:push
bun run build && systemctl restart sharebin
```

`db:push` applies additive changes in place. Read [CHANGELOG.md](../CHANGELOG.md)
for anything that needs manual action.
