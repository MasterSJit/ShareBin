import { db } from '@/lib/db'

// Use a 6-char base62 slug, fallback to 8 chars on collision.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomSlug(len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return s
}

export async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = randomSlug(attempt < 3 ? 6 : 8)
    const existing = await db.paste.findUnique({ where: { slug }, select: { id: true } })
    if (!existing) return slug
  }
  // Extremely unlikely fallback
  return randomSlug(12)
}

export const VISIBILITY = ['public', 'unlisted', 'private'] as const
export type Visibility = (typeof VISIBILITY)[number]

export const CONTENT_TYPE = ['text', 'file'] as const
export type ContentType = (typeof CONTENT_TYPE)[number]

export function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() < Date.now()
}

/**
 * Compute an expiry Date from a preset token.
 * Per spec §2.3 — Never, 10m, 1h, 1d, 1w, 1M, 1y, or custom ISO.
 */
export function computeExpiry(preset: string, customIso?: string): Date | null {
  if (preset === 'never') return null
  if (preset === 'custom') {
    if (!customIso) return null
    // If the client sent a full ISO string (with Z or offset), new Date handles it.
    // If it's a bare datetime-local string (YYYY-MM-DDTHH:MM), treat it as UTC
    // to match the client's new Date(...).toISOString() conversion.
    const normalized = customIso.includes('Z') || customIso.includes('+')
      ? customIso
      : customIso.length === 16
        ? customIso + ':00Z' // YYYY-MM-DDTHH:MM → add seconds + Z
        : customIso.endsWith('Z') ? customIso : customIso + 'Z'
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return null
    return d
  }
  const now = Date.now()
  const map: Record<string, number> = {
    '10m': 10 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  }
  const delta = map[preset]
  if (!delta) return null
  return new Date(now + delta)
}

/** Sanitise user-supplied title/description for safe display. */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .slice(0, 10000)
}

/** Audit log helper (spec §2.8 / §5.3). */
export async function auditLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  // BigInt-safe JSON serialization
  const safeStringify = (obj: unknown) => {
    return JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  }
  await db.auditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      metadata: metadata ? safeStringify(metadata) : null,
    },
  })
}

// ---- Site settings helpers -----------------------------------------------

const SETTING_DEFAULTS: Record<string, unknown> = {
  siteName: 'PasteShare',
  tagline: 'Share code & files with syntax-highlighted links.',
  defaultExpiry: 'never',
  maxFileSizeBytes: 25 * 1024 * 1024, // 25 MB
  allowedFileTypes: '*', // '*' = any, or comma list of MIME prefixes
  storageDriver: 'local',
  guestPostingEnabled: true,
  // SEO
  metaTitleTemplate: '{title} — PasteShare',
  metaDescriptionTemplate: 'A public paste on PasteShare.',
  metaKeywords: 'pastebin, code share, syntax highlighting',
  canonicalUrl: '', // base URL for canonical links
  ogType: 'website',
  ogImage: '', // URL to default OG image
  twitterCard: 'summary_large_image',
  twitterSite: '', // @username
  sitemapEnabled: true,
  robotsTxt: 'User-agent: *\nAllow: /\nDisallow: /api/',
  openGraphDefaults: { type: 'website', siteName: 'PasteShare' },
  // Verification & Analytics
  googleSiteVerification: '', // meta tag content
  googleAnalyticsId: '', // G-XXXXXXXX
  googleSearchConsoleUrl: '',
  bingSiteVerification: '',
  // Captcha
  captchaEnabled: false,
  captchaProvider: 'none', // 'none' | 'recaptcha' | 'turnstile' | 'hcaptcha'
  captchaSiteKey: '',
  captchaSecretKey: '',
  // Ads settings
  adsEnabled: false,
  adsenseClient: '', // ca-pub-XXXXXXXX
  // Performance
  cdnEnabled: false,
  cdnUrl: '',
  cacheTtl: 3600,
  enableGzip: true,
  // Logo & Branding
  logoUrl: '/logo.svg',
  faviconUrl: '/logo.svg',
  // Social
  socialLinks: {}, // {twitter, github, discord, etc.}
  // Spam/malware scanning
  bannedWords: [], // array of strings blocked in paste text content
  bannedFileExtensions: 'exe,bat,cmd,com,scr,msi,vbs,ps1,sh,so,dll', // comma list
  spamScanEnabled: true,
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await db.siteSetting.findMany()
  const merged: Record<string, unknown> = { ...SETTING_DEFAULTS }
  for (const row of rows) {
    try {
      merged[row.key] = JSON.parse(row.value)
    } catch {
      merged[row.key] = row.value
    }
  }
  return merged
}

export async function getSetting<T>(key: string): Promise<T> {
  const all = await getSettings()
  return all[key] as T
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value)
  await db.siteSetting.upsert({
    where: { key },
    update: { value: json },
    create: { key, value: json },
  })
}

export async function setSettings(patch: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    await setSetting(key, value)
  }
}

// ---- Background-ish job: flush view counters + expire soft-deleted pastes --

export function flushViewCounters() {
  // implemented in cache.ts via viewCounterDrain; this is the DB writer.
  // (Called from /api/cron/ping or inline on each view for simplicity here.)
}
