# PasteShare — Setup Guide

This document walks you through setting up PasteShare from scratch — installation, database configuration, seeding, and initial admin access.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | Or [Bun](https://bun.sh) 1.0+ (recommended) |
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

Create a `.env` file in the project root:

```env
# Database (SQLite — file path relative to project root)
DATABASE_URL="file:./db/custom.db"

# Session secret — MUST be at least 32 characters.
# Generate one with: openssl rand -hex 32
SESSION_SECRET="change-me-to-a-long-random-string-at-least-32-chars"

# Storage root for uploaded files (optional, defaults to ./storage)
STORAGE_LOCAL_ROOT="./storage"
```

### Production Environment Variables

For production deployment, also set:

```env
NODE_ENV="production"
# If using S3 storage (optional — local is default):
S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
# If using SMTP for email (optional — sandbox auto-verifies):
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
APP_URL="https://your-domain.com"
```

## Step 3: Database Setup

PasteShare uses Prisma ORM with SQLite. The schema is in `prisma/schema.prisma`.

### Push the schema to the database

```bash
bun run db:push
```

This creates the SQLite database file at `db/custom.db` and syncs all tables.

### Verify the database

```bash
# Open the SQLite shell to inspect tables
sqlite3 db/custom.db ".tables"
```

You should see:
```
Ad  AuditLog  Invoice  Paste  PasteAccessGrant  Payment  Permission  Plan  Role  RolePermission  SiteSetting  Subscription  UsageRecord  User
```

## Step 4: Seed the Database

The seed script creates:
- 25 RBAC permissions (paste, file, user, admin, subscription categories)
- 3 system roles: `user` (8 perms), `moderator` (16 perms), `admin` (25 perms)
- 3 system plans: `Free`, `Pro` ($9.99), `Business` ($29.99)
- 1 admin user: `admin@pasteshare.local / admin123`
- Default site settings (siteName, SEO, captcha, ads, etc.)

```bash
bun run prisma/seed.ts
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
3. Click the **"Fill"** button (auto-fills demo credentials)
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

PasteShare has two background jobs that should run on a schedule:

### Using crontab (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add these lines:
# Run cleanup every 10 minutes (hard-deletes expired/burned pastes)
*/10 * * * * curl -s -X POST https://your-domain.com/api/cron/cleanup > /dev/null

# Run subscription maintenance daily at midnight
0 0 * * * curl -s -X POST https://your-domain.com/api/cron/subscriptions > /dev/null
```

### Using a process manager (PM2 / systemd)

Create a script that calls the endpoints on a schedule. Example with `node-cron`:

```js
import cron from 'node-cron'
import fetch from 'node-fetch'

cron.schedule('*/10 * * * *', () => {
  fetch('https://your-domain.com/api/cron/cleanup', { method: 'POST' })
})

cron.schedule('0 0 * * *', () => {
  fetch('https://your-domain.com/api/cron/subscriptions', { method: 'POST' })
})
```

## Step 10: Production Build (optional)

```bash
# Build the production bundle
bun run build

# Start the production server
bun run start
```

**Note**: In the sandbox environment, use `bun run dev` only. Do not run `bun run build`.

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
# Delete the database file
rm db/custom.db

# Re-push the schema
bun run db:push

# Re-seed
bun run prisma/seed.ts
```

### Storage permissions

If file uploads fail, ensure the storage directory is writable:

```bash
mkdir -p storage
chmod 755 storage
```

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

## Next Steps

- Read the [README.md](./README.md) for the full feature list and API docs
- Explore the admin panel to configure settings, plans, and ads
- Set up cron jobs for cleanup and subscription maintenance
- Generate an API key from Admin → API for external integrations
