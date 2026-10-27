# ShareBin

> A self-hosted Pastebin / PrivateBin-style service for sharing **code, text and files** —
> syntax highlighting, burn-after-read, password protection, expiring links, ZIP browsing,
> a REST API with API keys, and a full admin panel. Built with Next.js 16, TypeScript,
> Prisma (SQLite) and Monaco Editor.

![ShareBin](public/logo.svg)

The site name, tagline, logo and SEO settings are configurable from **Admin → Settings**
(the codebase and seed data still use the original name *PasteShare* in a few places).

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Using ShareBin](#using-sharebin)
- [Command line & API](#command-line--api)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Security model](#security-model)
- [Scripts](#scripts)
- [Further documentation](#further-documentation)

---

## Features

### Sharing
- **Text pastes** in a Monaco editor with 50+ languages and **automatic language detection**
- **Markdown pastes** render as formatted documents (toggle back to source)
- **File sharing** — any file type, **multiple files per upload**, drag & drop, or
  **paste an image straight from the clipboard**; upload progress bar
- **Inline previews** for images, video & audio (with seeking), PDF and text files
- **ZIP archive browser** — list the contents of `.zip` (and `.jar`, `.docx`, `.xlsx`, …)
  files and extract single files without downloading the whole archive
- **Share dialog** after creating a paste: copyable link (`/p/<slug>`), raw link
  (`/raw/<slug>`) and reminders about burn/password settings
- **Clean short URLs** — `/p/<slug>` for the page, `/raw/<slug>` for plain text

### Privacy & lifetime
- **Visibility**: public (listed in Browse), unlisted (link only), private (owner only)
- **Password protection** (bcrypt) with signed, short-lived unlock tokens
- **Burn after read** — the first reader gets the content, then it is permanently deleted.
  Visitors see a *"this will self-destruct"* confirmation first, so link-preview bots and
  accidental clicks don't burn it; the owner's own views never burn it.
  Burn-after-read files can be downloaded exactly once.
- **Expiry presets** (10 min → 1 year, never, custom date); expired content is hard-deleted

### For signed-in users
- **Dashboard**: your pastes with search & filters, plan and usage (storage, monthly quota,
  views), profile, password change, account deletion (removes all your pastes and files)
- **Edit** your pastes (content, title, tags, language, visibility) from the paste page
- **Clone** any readable text paste into a new one
- **Download** a text paste as a file with the right extension
- **API key** — generate, copy, revoke; ready-to-run `curl` example

### Moderation & administration
- **Report** button for visitors → flags content for moderators
- **Admin panel**: overview & analytics, users, content, ads, roles (RBAC), plans,
  subscriptions, payments & invoices, usage, site settings, API settings, audit log
- **RBAC** with system roles `user`, `moderator`, `admin`; moderators (permission
  `admin:content`) can moderate content through the API
- **Plans** with per-plan limits (storage, paste size, monthly quota, allowed features)
- **Spam / malware scanning** of uploads (executables, macro documents, double extensions,
  admin-banned extensions) and banned words; optional strict mode for code signatures
- **Audit log** of admin actions and system jobs (auto-expiry, burns, reports)

### Platform
- REST API with a consistent `{ message, data: [] }` envelope and self-describing
  docs at `GET /api/docs`
- **API keys** (`x-api-key` or `Authorization: Bearer`) with per-key rate limiting,
  an on/off switch and CORS allow-list
- Plain-text **CLI uploads**: `curl --data-binary @file.txt https://host/api/paste?format=url`
- Health check at `GET /api/health`; cron endpoints for cleanup and subscriptions
- Dark/light theme, responsive layout, browser history (Back/Forward) support

---

## Quick start

### Prerequisites
- [Bun](https://bun.sh) 1.x (recommended) or Node.js 20+
- No database server — SQLite is bundled

### Install and run

```bash
git clone <your-repo-url> sharebin
cd sharebin
bun install
cp .env.example .env          # then set SESSION_SECRET (see below)
bun run db:push               # create / update the database schema
bun run db:seed               # roles, permissions, plans, settings, admin user
bun run dev                   # http://localhost:3000
```

Generate a session secret with:

```bash
openssl rand -hex 32
```

### Default admin account

| Email | Password |
|---|---|
| `admin@pasteshare.local` | `admin123` |

**Change this password immediately** (Dashboard → Change password). In development the
login page shows a "Fill" button for these credentials; it is hidden in production builds.

### Upgrading an existing installation

This release changes the database schema (session versioning, password-reset tokens,
nullable audit-log actor). The changes are additive — run this after pulling:

```bash
cp prisma/db/custom.db prisma/db/custom.db.bak   # backup first
bun run db:push
```

Everyone stays signed in. Unlock tokens and the old `x-unlocked` header from previous
versions no longer work — visitors simply re-enter paste passwords once.

---

## Using ShareBin

| Task | How |
|---|---|
| Create a paste | Type or paste into the editor on the home page → **Create paste** (or **Ctrl/⌘ + Enter**) |
| Upload files | **File** tab → drop files, click to browse, or paste an image with Ctrl/⌘ + V |
| Share | Copy the link from the dialog shown after creating; it looks like `https://host/p/Ab3dEf9h` |
| Raw text | `https://host/raw/<slug>` — works with `curl` and `wget` |
| One-time secret | Turn on **Burn after read** and send the link; don't open it yourself (unless logged in as the owner) |
| Password | Turn on **Password**; share the password through a different channel than the link |
| Edit / delete | Open your paste → **Edit** / **Delete** (or from the Dashboard) |
| Report abuse | Open the paste → **Report** |

Guests can create text pastes (if *guest posting* is enabled) with the guest limits:
1 MB per paste, expiry up to 1 day, burn-after-read allowed, no passwords, no private
pastes, no file uploads. Registered users get the **Free** plan unless an admin assigns
another one.

---

## Command line & API

Full reference: [docs/API.md](docs/API.md) — or fetch `GET /api/docs` from a running instance.

```bash
HOST=https://paste.example.com
KEY=ps_xxxxxxxxxxxxxxxx           # Dashboard → API key

# Create a paste from a file and get the link back
curl -H "x-api-key: $KEY" --data-binary @script.py \
  "$HOST/api/paste?language=python&expiryPreset=1w&format=url"

# Pipe anything (works as a guest too, if guest posting is enabled)
echo "hello" | curl --data-binary @- "$HOST/api/paste?format=url"

# JSON body
curl -H "x-api-key: $KEY" -H "content-type: application/json" \
  -d '{"textContent":"SELECT 1;","language":"sql","visibility":"unlisted"}' \
  "$HOST/api/paste"

# Upload a file
curl -H "x-api-key: $KEY" -F "file=@report.pdf" -F visibility=unlisted "$HOST/api/file?format=url"

# Read raw text (password-protected paste)
curl -H "x-paste-password: hunter2" "$HOST/raw/Ab3dEf9h"

# Your pastes
curl -H "Authorization: Bearer $KEY" "$HOST/api/paste?scope=own"
```

---

## Configuration

### Environment variables (`.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | SQLite URL. Relative paths resolve from `prisma/`, so `file:./db/custom.db` → `prisma/db/custom.db` |
| `SESSION_SECRET` | **yes in production** | 32+ random characters. Signs sessions and paste unlock tokens |
| `STORAGE_LOCAL_ROOT` | no | Upload directory (default `./storage`) |
| `APP_URL` | no | Public base URL for share links when the admin *canonical URL* is empty |
| `CRON_SECRET` | recommended | Protects `/api/cron/*` (`Authorization: Bearer <secret>`) |
| `PRISMA_LOG_QUERIES` | no | `1` logs every SQL query |
| `ALLOW_INSECURE_RESET_TOKENS` | no | `1` returns reset tokens in the API response in production. **Demo only** |
| `INSECURE_COOKIES` | no | `1` drops the `Secure` cookie flag in production (plain-HTTP intranets) |
| `SMTP_*` | no | For when you wire a mailer into `src/lib/mailer.ts` |

See [.env.example](.env.example) for a commented template.

### Site settings (Admin → Settings / API)

Branding (name, tagline, logo, favicon), SEO & social cards, analytics/verification,
guest posting, default expiry, **max file size**, **allowed file types**
(`*`, `image/*`, `application/pdf`, `.zip`, …), banned file extensions, banned words,
spam scanning (and strict mode), ads, and the external API (enable/disable, per-key rate
limit, CORS origins). Settings are cached for 5 seconds.

---

## Project structure

```
prisma/
  schema.prisma            Database schema
  seed.ts                  Roles, permissions, plans, settings, admin user
  db/custom.db             SQLite database (default location)
src/
  proxy.ts                 API gateway: API-key rate limit, API on/off, CORS
  app/
    page.tsx               Single-page client (hash routing: #/p/<slug>, #/dashboard …)
    p/[slug]/route.ts      /p/<slug>  → redirects to the paste page
    raw/[slug]/route.ts    /raw/<slug> → plain-text body
    api/                   REST API (see docs/API.md)
  components/
    views/                 Home, Browse, Paste, Dashboard, Admin, Auth views
    share-dialog.tsx       Post-create share dialog
    file-preview.tsx       File previews incl. one-time burn download
    zip-listing.tsx        ZIP archive browser
  lib/
    auth.ts                Sessions, API keys, password hashing
    paste-access.ts        Access control, unlock tokens, burn claim
    paste-read.ts          Single-paste read & raw serving
    paste-create.ts        Shared create validation, share URLs
    rbac.ts                Permissions, plans, usage & limits
    cleanup.ts             Hard deletes, expiry/burn cleanup
    security-scan.ts       Spam/malware scanner
    storage.ts             Local file storage (range reads)
    zip.ts                 ZIP reader (list + extract)
docs/                      Detailed documentation
storage/                   Uploaded files (default)
```

---

## Security model

Highlights — details in [docs/SECURITY.md](docs/SECURITY.md):

- Sessions are HMAC-signed cookies **re-validated on every request**: bans, role
  changes and password changes take effect immediately (password change/reset signs out
  every other session).
- Paste passwords are bcrypt-hashed; unlocking issues a 1-hour token bound to the paste
  **and** its current password. Guessing is rate-limited.
- Burn-after-read uses an atomic database claim, so only one reader ever gets the content.
- Uploaded files are served with `X-Content-Type-Options: nosniff` and a sandboxing CSP;
  HTML/JS uploads are never rendered on the site's origin.
- Public profile endpoints never expose emails or API keys; search never matches inside
  password-protected or burn-after-read pastes.
- Password-reset tokens are single-use, stored hashed, and only returned in API responses
  in development.

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Development server on port 3000 (logs to `dev.log`) |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Start the production server |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript check |
| `bun run db:push` | Apply the Prisma schema to the database |
| `bun run db:seed` | Seed roles, permissions, plans, settings and the admin user |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run db:reset` | Reset the database (**destroys data**) |

---

## Further documentation

| Document | Contents |
|---|---|
| [SETUP.md](SETUP.md) | Step-by-step installation and first configuration |
| [docs/API.md](docs/API.md) | REST API reference with examples |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is built: request flows, data model, access control |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and hardening checklist |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment, cron, reverse proxy, backups |
| [CHANGELOG.md](CHANGELOG.md) | What changed in this release |

## License

MIT
