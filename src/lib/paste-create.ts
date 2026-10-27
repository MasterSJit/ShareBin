import type { NextRequest } from 'next/server'
import { forbidden, unprocessable } from '@/lib/api-response'
import { computeExpiry, getSettings, listSetting, VISIBILITY } from '@/lib/paste-utils'
import { isExpiryAllowed, type PlanLimits } from '@/lib/rbac'
import type { SessionPayload } from '@/lib/auth'

/** Options shared by text pastes and file uploads. */
export type CreateOptionsInput = {
  visibility?: string | null
  password?: string | null
  burnAfterRead?: boolean
  expiryPreset?: string | null
  expiryCustom?: string | null
}

export type CreateOptions = {
  visibility: 'public' | 'unlisted' | 'private'
  password: string | null
  burnAfterRead: boolean
  expiryPreset: string
  expiresAt: Date | null
}

/**
 * Validate paste options against the caller's plan. Returns either the
 * normalised options or a ready-to-return error response.
 */
export async function validateCreateOptions(
  input: CreateOptionsInput,
  session: SessionPayload | null,
  limits: PlanLimits,
): Promise<{ ok: true; options: CreateOptions } | { ok: false; response: Response }> {
  const fail = (response: Response) => ({ ok: false as const, response })

  const visibility = (VISIBILITY as readonly string[]).includes(input.visibility || '')
    ? (input.visibility as CreateOptions['visibility'])
    : 'public'
  if (visibility === 'private') {
    if (!session) return fail(forbidden('Private pastes require login'))
    if (!limits.allowPrivate) {
      return fail(forbidden(`Private pastes require a Pro plan or higher (current: ${limits.planName})`))
    }
  }

  const password = input.password ? String(input.password) : null
  if (password && password.length > 256) return fail(unprocessable('Password is too long (max 256 characters)'))
  const burnAfterRead = !!input.burnAfterRead

  if (burnAfterRead && !limits.allowBurnAfterRead) {
    return fail(forbidden(`Burn-after-read requires a higher plan (current: ${limits.planName})`))
  }
  if (password && !limits.allowPassword) {
    return fail(forbidden(`Password protection requires a higher plan (current: ${limits.planName})`))
  }
  if (burnAfterRead && password) {
    return fail(unprocessable('Burn-after-read cannot be combined with password protection'))
  }

  // Fall back to the site's default expiry when the client doesn't choose one.
  const settings = await getSettings()
  const siteDefault = typeof settings.defaultExpiry === 'string' ? settings.defaultExpiry : 'never'
  let expiryPreset = input.expiryPreset || siteDefault
  if (!input.expiryPreset && !isExpiryAllowed(expiryPreset, limits)) expiryPreset = 'never'
  if (!isExpiryAllowed(expiryPreset, limits)) {
    if (expiryPreset === 'custom') {
      return fail(forbidden(`Custom expiry requires a Pro plan or higher (current: ${limits.planName})`))
    }
    return fail(forbidden(`Expiry "${expiryPreset}" is not available on your plan (current: ${limits.planName})`))
  }
  const expiresAt = computeExpiry(expiryPreset, input.expiryCustom ?? undefined)
  if (expiryPreset === 'custom' && !expiresAt) return fail(unprocessable('Invalid custom expiry date'))
  if (expiryPreset !== 'never' && expiryPreset !== 'custom' && !expiresAt) {
    return fail(unprocessable(`Unknown expiry preset "${expiryPreset}"`))
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) return fail(unprocessable('Expiry date is in the past'))

  return { ok: true, options: { visibility, password, burnAfterRead, expiryPreset, expiresAt } }
}

/** Spam-scan options derived from site settings. */
export async function getScanSettings() {
  const s = await getSettings()
  return {
    enabled: s.spamScanEnabled !== false,
    strict: s.spamScanStrict === true,
    bannedWords: listSetting(s.bannedWords),
    bannedExtensions: listSetting(s.bannedFileExtensions),
    maxFileSizeBytes: typeof s.maxFileSizeBytes === 'number' ? s.maxFileSizeBytes : 25 * 1024 * 1024,
    allowedFileTypes: listSetting(s.allowedFileTypes),
  }
}

/**
 * Check a MIME type / file name against the `allowedFileTypes` setting.
 * Entries may be `*`, a MIME prefix (`image/`), a full MIME (`application/pdf`),
 * a wildcard (`image/*`) or an extension (`.zip` / `zip`).
 */
export function isFileTypeAllowed(allowed: string[], mimeType: string, fileName: string): boolean {
  if (allowed.length === 0 || allowed.includes('*')) return true
  const mime = mimeType.toLowerCase()
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  return allowed.some((rule) => {
    if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1))
    if (rule.endsWith('/')) return mime.startsWith(rule)
    if (rule.includes('/')) return mime === rule
    return ext !== '' && rule.replace(/^\./, '') === ext
  })
}

/**
 * Public base URL used to build share links: the admin-configured canonical
 * URL, then APP_URL, then the request's own origin.
 */
export async function siteBaseUrl(req: NextRequest): Promise<string> {
  const s = await getSettings()
  const canonical = typeof s.canonicalUrl === 'string' ? s.canonicalUrl.trim() : ''
  if (canonical) return canonical.replace(/\/+$/, '')
  const envUrl = process.env.APP_URL?.trim()
  if (envUrl && !envUrl.includes('your-domain.com')) return envUrl.replace(/\/+$/, '')
  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host
  return `${proto}://${host}`
}

/** Share links for a paste. */
export function pasteLinks(base: string, p: { slug: string; contentType: string }) {
  return {
    url: `${base}/p/${p.slug}`,
    rawUrl: p.contentType === 'text' ? `${base}/raw/${p.slug}` : `${base}/api/file?id=${p.slug}`,
  }
}
