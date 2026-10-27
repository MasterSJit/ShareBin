# ShareBin — Setup Guide

This document walks you through setting up ShareBin (formerly PasteShare) from scratch — installation, database configuration, seeding, and initial admin access. For production hosting see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20+ | Or [Bun](https://bun.sh) 1.x (recommended) |
| OS | Linux / macOS / Windows | SQLite is bundled — no separate DB server needed |
| Git | Any | To clone the repository |

### Install Bun (recommended)

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify: `bun --version`

## Step 1: Clone & Install

```bash
git clone <your-repo-url> pasteshare
cd pasteshare

# Install all dependencies
bun install
```

This installs:
- Next.js 16, React 19, TypeScript 5
- Prisma 6 + @prisma/client
- shadcn/ui components (Radix UI primitives)
- Monaco Editor, Framer Motion, GSAP, Recharts
- bcryptjs, zod, lucide-react, sonner, next-themes

## Step 2: Environment Variables

Copy the template and edit it:

```bash
cp .env.example .env
```

At minimum set `SESSION_SECRET` (32+ random characters):

```bash
openssl rand -hex 32
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file. Relative paths resolve from `prisma/`, so `file:./db/custom.db` means `prisma/db/custom.db` |
| `SESSION_SECRET` | Signs sessions and paste unlock tokens (required in production) |
| `STORAGE_LOCAL_ROOT` | Upload directory (default `./storage`) |
| `APP_URL` | Public URL for share links (optional) |
| `CRON_SECRET` | Protects `/api/cron/*` (recommended in production) |

The full list, with explanations, is in [.env.example](.env.example).

## Step 3: Database Setup

PasteShare uses Prisma ORM with SQLite. The schema is in `prisma/schema.prisma`.

### Push the schema to the database

```bash
bun run db:push
```

This creates the SQLite database (by default `prisma/db/custom.db` — Prisma resolves relative SQLite paths from the `prisma/` folder) and syncs all tables. Re-run it after every upgrade; it applies additive schema changes in place.

### Verify the database

```bash
# Open the SQLite shell to inspect tables
sqlite3 prisma/db/custom.db ".tables"
```

You should see:
```
Ad  AuditLog  Invoice  Paste  PasteAccessGrant  PasswordResetToken  Payment  Permission  Plan  Role  RolePermission  SiteSetting  Subscription  UsageRecord  User
```

## Step 4: Seed the Database

The seed script creates:
- 25 RBAC permissions (paste, file, user, admin, subscription categories)
- 3 system roles: `user` (8 perms), `moderator` (16 perms), `admin` (25 perms)
- 3 system plans: `Free`, `Pro` ($9.99), `Business` ($29.99)
- 1 admin user: `admin@pasteshare.local / admin123`
- Default site settings (siteName, SEO, captcha, ads, etc.)

```bash
bun run db:seed
```

Expected output:
```
Seeded 25 permissions
Seeded role: user (8 perms)
Seeded role: moderator (16 perms)
Seeded role: admin (25 perms)
Seeded plan: Free
Seeded plan: Pro
Seeded plan: Business
Seeded admin user: admin@pasteshare.local / admin123
Seeded default site settings.
```

## Step 5: Start the Development Server

```bash
bun run dev
```

The app will be available at `http://localhost:3000`.

### Verify the setup

1. Open `http://localhost:3000` in your browser
2. Click **"Log in"** in the header
3. Click the **"Fill"** button (auto-fills demo credentials — shown in development only)
4. Click **"Log in"** — you should see "Dashboard" and "Admin" in the header
5. Click **"Admin"** to access the admin panel

## Step 6: Initial Configuration

After logging in as admin, configure the site:

### 6.1 Branding
1. Go to **Admin → Settings**
2. Set `siteName`, `tagline`, `logoUrl`, `faviconUrl`
3. Click **Save**

### 6.2 SEO
1. In the same Settings tab, scroll to **SEO** section
2. Set `metaTitleTemplate`, `metaDescriptionTemplate`, `metaKeywords`
3. Set `canonicalUrl` (your production domain)
4. Configure Open Graph (`ogType`, `ogImage`) and Twitter cards

### 6.3 Google Analytics & Search Console
1. Scroll to **Verification & Analytics**
2. Enter your `googleAnalyticsId` (e.g., `G-XXXXXXXXXX`)
3. Enter `googleSiteVerification` (the content attribute of the meta tag)
4. Enter `googleSearchConsoleUrl`

### 6.4 Captcha (optional)
1. Scroll to **Captcha**
2. Enable `captchaEnabled`
3. Select `captchaProvider` (recaptcha / turnstile / hcaptcha)
4. Enter your `captchaSiteKey` and `captchaSecretKey`

### 6.5 API Settings
1. Go to **Admin → API**
2. Enable API access (`apiEnabled = true`)
3. Set rate limits and CORS origins
4. Generate an API key for external use

### 6.6 Uploads & spam rules
1. **Admin → Settings → Storage**: max file size, allowed file types (`*`, `image/*`, `application/pdf`, `.zip`, …), banned extensions
2. Banned words and spam scanning live in the same tab. Leave *strict scanning* off for a code-sharing site — it rejects legitimate code that mentions `<script>`, SQL keywords, `exec(` and similar

### 6.7 Change the admin password
Dashboard → **Change password**. Do this before exposing the site.

## Step 7: Create Additional Admin Users (optional)

1. Go to **Admin → Users**
2. Click **"Add User"**
3. Fill in email, password, display name
4. Set role to `admin`
5. Click **"Create user"**

Alternatively, change an existing user's role:
1. Find the user in the Users table
2. Click the action menu (⋮) → **"Promote to admin"**

## Step 8: Configure Subscription Plans (optional)

Default plans are pre-seeded, but you can customize:

1. Go to **Admin → Plans**
2. Click **"Edit"** on any plan
3. Adjust: monthlyPrice, maxStorageBytes, maxPasteSize, maxPastesPerMonth, feature flags
4. Click **"Save changes"**

To assign a plan to a user:
1. Go to **Admin → Subscriptions**
2. Click **"Assign"**
3. Select the user and plan
4. Set an expiry date (or leave null for lifetime)
5. Click **"Assign"**

## Step 9: Set Up Cron Jobs (production)

Two maintenance endpoints should run on a schedule. Set `CRON_SECRET` in `.env` and send it with each call:

```bash
crontab -e
```

```cron
# Remove expired / burned pastes every 10 minutes
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/cleanup > /dev/null
# Subscription maintenance daily
0 3 * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/subscriptions > /dev/null
```

Without `CRON_SECRET` the endpoints stay open (they only delete already-expired data).

## Step 10: Production Build (optional)

```bash
# Build the production bundle
bun run build

# Start the production server
bun run start
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for reverse proxy, process manager, health check and backup instructions.

## Troubleshooting

### Database errors

**"PrismaClientValidationError"** or **"Cannot read properties of undefined"**
- The Prisma client may be stale after a schema change.
- Fix: `bun run db:generate` then restart the dev server.

```bash
bun run db:generate
# Then restart: pkill -f "next dev" && bun run dev
```

### Port already in use

```bash
# Kill any process on port 3000
lsof -ti:3000 | xargs kill -9
# Or
fuser -k 3000/tcp
```

### Reset the database

If you want to start fresh:

```bash
# Delete the database file (destroys all data!)
rm prisma/db/custom.db

# Re-push the schema
bun run db:push

# Re-seed
bun run db:seed
```

### Storage permissions

If file uploads fail, ensure the storage directory is writable:

```bash
mkdir -p storage
chmod 755 storage
```

### Styles don't update in development / "inferred your workspace root" warning

A lockfile outside the project (for example `~/package-lock.json`) makes Next.js treat a parent folder as the project root, and the dev server can then keep serving cached CSS. Remove the stray lockfile, or stop the dev server and delete the `.next/dev` folder.

### Password reset emails

No mail library is bundled. In development the reset token is shown on screen. For production, plug a mailer into `src/lib/mailer.ts` (instructions in the file); until then admins can set a new password from **Admin → Users**.

### Monaco editor not loading

The Monaco editor loads dynamically (browser-only). If it doesn't appear:
1. Check the browser console for errors
2. Ensure you're not blocking `/_next/static` resources
3. Try hard-refreshing (Ctrl+Shift+R)

## Verification Checklist

After setup, verify these work:

- [ ] `http://localhost:3000` loads the home page
- [ ] You can create a text paste (Monaco editor is clickable)
- [ ] You can log in as `admin@pasteshare.local / admin123`
- [ ] Admin panel is accessible (all 12 tabs)
- [ ] You can create a user from Admin → Users → Add User
- [ ] API docs are accessible at `http://localhost:3000/api/docs`
- [ ] Cron cleanup works: `curl -X POST http://localhost:3000/api/cron/cleanup`
- [ ] Health check: `curl http://localhost:3000/api/health` returns `{"status":"ok",…}`
- [ ] A burn-after-read paste shows the share dialog, and opening the link shows the "self-destruct" confirmation

## Next Steps

- Read the [README.md](./README.md) for the full feature list and API docs
- Explore the admin panel to configure settings, plans, and ads
- Set up cron jobs for cleanup and subscription maintenance
- Generate an API key from Admin → API for external integrations
