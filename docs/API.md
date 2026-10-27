# API reference

A running instance also describes its public endpoints at `GET /api/docs` (JSON).

## Conventions

### Response envelope

Every JSON endpoint answers with:

```json
{ "message": "Paste created successfully", "data": [ { "...": "..." } ] }
```

`data` is **always an array** (single resources are wrapped in a one-element array).
Exceptions that return raw bodies: `/raw/<slug>`, `/api/paste/raw`, file downloads,
ZIP entry extraction, `/api/health`, and `?format=url` responses.

### Methods

| Method | Meaning |
|---|---|
| `PUT` | Create (`POST` is accepted as an alias for paste/file creation) |
| `GET` | Read / list |
| `PATCH` | Update — the id goes in the body (`{ "id": "…" }`), the query (`?id=`) or the path |
| `DELETE` | Delete — id in body or query |

Paste ids and slugs are interchangeable wherever an `id` is accepted.

### Status codes

| Code | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 206 | Partial content (file `Range` requests) |
| 302 | Redirect (`/p/<slug>`, raw URL of a file paste) |
| 400 | Invalid input |
| 401 | Not authenticated / wrong paste password |
| 403 | Not allowed (role, plan limit, password required for raw/file) |
| 404 | Not found |
| 409 | Conflict (email taken; inline preview of a burn-after-read file) |
| 410 | Gone — expired or burned |
| 413 | Upload larger than the allowed size |
| 416 | Unsatisfiable `Range` |
| 422 | Rejected by validation or the spam/malware scanner |
| 429 | Rate limited (`Retry-After` header on API-key limits) |
| 503 | Health check: database unreachable |

### Authentication

| Method | How | Notes |
|---|---|---|
| Session cookie | `POST /api/auth/login` or register sets `ps_session` (httpOnly, SameSite=Strict, 7 days) | Re-validated on every request |
| API key | `x-api-key: ps_…` or `Authorization: Bearer ps_…` | Generate in the dashboard or `PATCH /api/user {"regenerateApiKey":true}` |

API-key requests are checked by `src/proxy.ts`:

- `403 API access is disabled on this site` when the admin turned the API off
- `429` when the per-key limit (`apiRateLimit`, default 60/min) is exceeded
- every response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`

Cross-origin browser requests are only allowed from origins in the `apiCorsOrigins`
setting (`*` for any); credentials (cookies) are never allowed cross-origin.

### Paste passwords

A password-protected paste returns `passwordRequired: true` (JSON) or `403` (raw/file)
until the caller proves the password in one of these ways:

1. `POST /api/paste/unlock` → sets an httpOnly `ps_ul_<pasteId>` cookie (browsers) and
   returns a `token`, valid 1 hour and bound to the current password
2. send that token as `x-unlock-token: <token>` or `?token=<token>`
3. one-shot: send the password itself as `x-paste-password: <password>`

Wrong guesses are limited to 10 per minute per IP and paste.

### The `SafePaste` object

| Field | Type | Notes |
|---|---|---|
| `id`, `slug` | string | slug is the short share code (8 chars for new pastes) |
| `title`, `description` | string \| null | |
| `tags` | string[] | |
| `contentType` | `"text"` \| `"file"` | |
| `language` | string | Monaco language id, e.g. `python` |
| `visibility` | `"public"` \| `"unlisted"` \| `"private"` | |
| `hasPassword`, `burnAfterRead`, `isBurned`, `isFlagged`, `isExpired` | boolean | |
| `viewCount` | number | |
| `expiresAt`, `createdAt`, `updatedAt` | ISO date \| null | |
| `ownerId` | string \| null | null for guest pastes |
| `ownerName` | string \| null | display name only — never an email |
| `originalFileName`, `mimeType`, `fileSizeBytes` | | file pastes |
| `sizeBytes`, `lineCount` | number | size of text/file; lines (text) |
| `textContent` | string | only on single reads you are allowed to see |
| `preview` | string | listings only; first ~240 chars of unlocked text pastes |
| `passwordRequired`, `burnPending`, `isOwner` | boolean | single-paste responses |
| `url`, `rawUrl` | string | create responses only |

---

## Pastes

### `PUT /api/paste` — create a text paste

Auth optional (guests allowed when *guest posting* is on). `POST` works too.

JSON body:

```json
{
  "textContent": "print('hi')",
  "title": "Greeter",
  "description": "optional",
  "tags": "python, demo",
  "language": "python",
  "visibility": "public",
  "password": "optional",
  "burnAfterRead": false,
  "expiryPreset": "1w",
  "expiryCustom": "2026-12-31T23:59:00Z"
}
```

- `expiryPreset`: `never`, `10m`, `1h`, `1d`, `1w`, `1M`, `1y`, `custom` (needs
  `expiryCustom`). Defaults to the site's *default expiry*.
- Password and burn-after-read can't be combined.
- Plan limits apply (size, monthly quota, private/password/burn/custom-expiry flags).

**Plain-text body** (CLI): send the content as the body with any non-JSON content type
and pass options in the query string:

```bash
curl --data-binary @main.go "$HOST/api/paste?language=go&title=main.go&expiryPreset=1d"
```

`?format=url` makes the response just the share URL (`text/plain`, 201).

Response `201`: `SafePaste` plus `url` and `rawUrl`.

### `GET /api/paste?id=<slug>` — read one paste

Also `GET /api/paste/<slug>`.

| Query | Effect |
|---|---|
| `peek=1` | Metadata only: no content, no view counted, **never burns** |

Behaviour:

- password-protected and not unlocked → `200` with `passwordRequired: true`, no content
- burn-after-read text paste read by someone other than the owner/a moderator → the
  content is returned once with `isBurned: true`, then deleted; later reads → `410`
- file pastes → metadata only (bytes come from `/api/file`); `burnPending: true` means
  the download will destroy it
- owners and moderators don't increase `viewCount` and never burn

### `GET /api/paste` — list

| Query | Values |
|---|---|
| `scope` | `public` (default), `own` (auth), `trending` (most viewed, last 30 days), `language` |
| `language` | with `scope=language` |
| `type` | `text`, `file` |
| `tag` | tag filter |
| `q` | search title, description, tags, language, file name, slug, and the body of unlocked pastes |
| `page`, `pageSize` | default 1 / 20, max 50 |

Response headers: `X-Total-Count`, `X-Page`, `X-Page-Size`. Public listings never
include expired, burned, private or unlisted pastes.

### `PATCH /api/paste` — update

Owner, or a moderator (`admin:content`). Body: `id` plus any of `title`, `description`,
`tags`, `language`, `textContent`, `visibility`, `password` (`null`/`""` removes it),
`burnAfterRead`, `expiryPreset` (+ `expiryCustom`). Plan limits are checked against the
paste owner's plan.

### `DELETE /api/paste` — delete

Owner or moderator. Body `{ "id": "…" }`. Permanently deletes the paste, its file and
access grants.

### `GET /raw/<slug>` and `GET /api/paste/raw?id=<slug>` — raw text

Plain text; errors are plain text too. Same access rules as above, including burning.
`?dl=1` downloads with a file name based on the title and language
(e.g. `greeter.py`). For a file paste this redirects to the file download.

### `GET /p/<slug>`

Redirects (`302`) to the paste page in the web app. Use it as the share link.

### `POST /api/paste/unlock`

Body `{ "id": "<slug>", "password": "…" }`.

```json
{ "message": "Paste unlocked",
  "data": [{ "id": "cm…", "slug": "Ab3dEf9h", "unlocked": true,
             "token": "1793115398769.4WEks…", "expiresAt": "…" }] }
```

Errors: `401` wrong password, `429` too many attempts, `400` not password-protected.

### `POST /api/paste/report`

No auth needed. Body `{ "id": "<slug>", "reason": "spam", "details": "optional" }`.
`reason` ∈ `spam`, `malware`, `phishing`, `illegal`, `personal_info`, `copyright`,
`other`. Flags the paste for moderators and writes an audit-log entry. 5 reports per
10 minutes per IP.

---

## Files

### `PUT /api/file` — upload

`multipart/form-data` with a `file` field plus the same options as text pastes
(`title`, `description`, `tags`, `visibility`, `password`, `burnAfterRead`,
`expiryPreset`, `expiryCustom`). `POST` works too, as does `?format=url`.

Checks, in order: plan allows uploads (guests can't by default) → rate limit → size
(smaller of the plan's per-paste size and the site's `maxFileSizeBytes`) →
`allowedFileTypes` → storage quota → monthly quota → options → malware scan.

```bash
curl -H "x-api-key: $KEY" -F "file=@photo.jpg" -F visibility=unlisted "$HOST/api/file"
```

### `GET /api/file?id=<slug>` — download

| Query | Effect |
|---|---|
| (none) | Download (`Content-Disposition: attachment`), counts a view |
| `inline=1` | Render in the browser for safe types — images, audio/video, PDF; text is served as `text/plain`. No view counted |
| `meta=1` | JSON metadata only |
| `token=` | Unlock token for password-protected files |

- `Range: bytes=…` is supported (`206`) for seeking audio/video.
- Every response has `X-Content-Type-Options: nosniff`; everything except PDF also gets
  a sandboxing `Content-Security-Policy`.
- Burn-after-read files: one successful download, then `410`. `inline=1` → `409`.

### `GET /api/file/zip?id=<slug>` — browse an archive

Lists up to 5000 entries:

```json
{ "data": [{ "total": 3, "truncated": false, "limit": 5000,
  "entries": [{ "name": "src/index.js", "isDirectory": false, "size": 18,
                "compressedSize": 18, "method": 0, "encrypted": false,
                "modifiedAt": "2026-10-27T14:24:00.000Z" }] }] }
```

`&entry=<path>` extracts that single entry as a download (stored or deflated entries,
up to 50 MB; encrypted entries can't be extracted). Not available for burn-after-read
files. `422` if the file isn't a readable ZIP.

### `DELETE /api/file`

Same as `DELETE /api/paste`, for file pastes.

---

## Accounts

| Endpoint | Description |
|---|---|
| `PUT /api/user` | Register `{ email, password (8+), displayName? }`; signs in. `403` when registration is closed |
| `POST /api/auth/login` | `{ email, password }` → session cookie. 10 attempts/min per IP, 20 per 15 min per account |
| `POST /api/auth/logout` | Clears the cookie |
| `GET /api/auth/me` | Current user (cookie or API key), including your API key |
| `POST /api/auth/refresh` | Re-issue the session cookie (sliding expiry) |
| `POST /api/auth/forgot-password` | `{ email }` → always `200`. In development the response includes `{ token, link }` |
| `POST /api/auth/reset-password` | `{ token, password }` — single use, signs out all sessions |
| `POST /api/auth/verify` | Marks the current user verified (sandbox helper) |
| `GET /api/user` | Own profile |
| `GET /api/user?id=<userId>` | Public profile (full record for admins) |
| `GET /api/user/<userId>` | Public profile, no auth: `{ id, displayName, createdAt, publicPastes }` |
| `PATCH /api/user` | `displayName`; `currentPassword` + `newPassword`; `regenerateApiKey`; `revokeApiKey` |
| `DELETE /api/user` | `{ currentPassword }` — deletes the account **and all its pastes and files** |
| `GET /api/me/limits` | Your plan, limits, subscription and usage |

---

## Site

| Endpoint | Description |
|---|---|
| `GET /api/settings` | Public settings (branding, SEO, guest posting, registration, default expiry, max file size, allowed types) |
| `GET /api/languages` | Languages used by public text pastes, with counts |
| `GET /api/ads?slot=<slot>` | Active ads for a slot (`header`, `sidebar`, `footer`, `between-cards`, `paste-top`, `paste-bottom`) |
| `POST /api/ads/click` | `{ id }` — record an ad click |
| `GET /api/health` | `{ status, db, latencyMs, time }`; `503` if the database is down |
| `GET /api/docs` | Machine-readable docs of the public API |

## Cron

Run these on a schedule (see [DEPLOYMENT.md](DEPLOYMENT.md)). `GET` and `POST` both work.
When `CRON_SECRET` is set, send it as `Authorization: Bearer <secret>`,
`x-cron-secret: <secret>` or `?key=<secret>`.

| Endpoint | Suggested schedule | Does |
|---|---|---|
| `/api/cron/cleanup` | every 10 min | Hard-deletes expired and burned pastes (and files), expired reset tokens |
| `/api/cron/subscriptions` | daily | Expires overdue subscriptions, logs ones expiring within 7 days |

Listing requests also run the cleanup opportunistically (at most once a minute).

---

## Admin API

All require an admin session (or the noted permission). Body conventions as above.

| Endpoint | Methods | Notes |
|---|---|---|
| `/api/admin/analytics` | GET | KPIs, 14-day creation chart, top languages |
| `/api/admin/trending` | GET | `?limit=&days=` most viewed public pastes |
| `/api/admin/user` (`/[id]`) | GET PUT PATCH DELETE | Search `?q=&status=`. PATCH: `status`, `role`/`roleId`, `displayName`, `email`, `password`, `verify`, `regenerateApiKey`. A new password, ban or suspension signs the user out everywhere. DELETE also deletes the user's pastes and files |
| `/api/admin/paste` (`/[id]`) | GET PATCH DELETE | Admin or `admin:content`. GET `?q=&flagged=1&expired=1&type=`. PATCH: `isFlagged`, `visibility`, `forceExpire`, `expiresAt`, `title`, `description`, `tags`, `language`, `textContent`, `viewCount`, `resetViews` |
| `/api/admin/settings` | GET PATCH | All settings incl. secrets. Keys must be alphanumeric; booleans/numbers validated |
| `/api/admin/role` | GET PUT PATCH DELETE | `admin:rbac`. System roles can't be renamed or deleted |
| `/api/admin/permission` | GET | `admin:rbac` |
| `/api/admin/plan` | GET PUT PATCH DELETE | GET: any signed-in user. Others `admin:plans`. Plans with payments are deactivated instead of deleted; system plans can't be renamed |
| `/api/admin/subscription` | GET PUT PATCH DELETE | `admin:subscriptions`. `?status=`, `?expiring=1` |
| `/api/admin/payment` | GET PUT PATCH DELETE | `admin:subscriptions` |
| `/api/admin/invoice` (`/[id]`) | GET | `admin:subscriptions` |
| `/api/admin/usage` | GET | `?userId=` for one user (self allowed) |
| `/api/admin/ad` (`/[id]`) | GET PUT PATCH DELETE | Ads management |
| `/api/admin/audit` | GET DELETE | GET: admin or `admin:audit`; `?action=&targetType=&targetId=&limit=` (≤500). System jobs appear as actor `system` |
