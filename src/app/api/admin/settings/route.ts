import { NextRequest } from 'next/server'
import { ok, unauthorized, forbidden, badRequest } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { getSettings, setSettings } from '@/lib/paste-utils'
import { auditLog } from '@/lib/paste-utils'

const BOOLEAN_KEYS = [
  'guestPostingEnabled', 'sitemapEnabled', 'registrationEnabled', 'spamScanEnabled', 'spamScanStrict',
  'captchaEnabled', 'adsEnabled', 'cdnEnabled', 'enableGzip', 'apiEnabled', 'apiRequireAuth',
]
const EXPIRY_PRESETS = ['never', '10m', '1h', '1d', '1w', '1M', '1y']
const SECRET_KEYS = new Set(['captchaSecretKey'])

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  if (session.role !== 'admin') return { error: forbidden('Admin only') as Response, session: null }
  return { error: null, session }
}

// GET /api/admin/settings
export async function GET(_req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error
  const settings = await getSettings()
  return ok('Site settings', [settings])
}

// PATCH /api/admin/settings — partial update
export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  // Validate a few critical fields
  if (body.maxFileSizeBytes !== undefined) {
    const n = Number(body.maxFileSizeBytes)
    if (!Number.isFinite(n) || n < 1024) return badRequest('maxFileSizeBytes must be >= 1024')
    body.maxFileSizeBytes = n
  }
  if (body.storageDriver !== undefined && !['local', 's3'].includes(String(body.storageDriver))) {
    return badRequest('storageDriver must be local or s3')
  }
  for (const key of BOOLEAN_KEYS) {
    if (body[key] !== undefined) body[key] = body[key] === true || body[key] === 'true'
  }
  if (body.apiRateLimit !== undefined) {
    const n = Number(body.apiRateLimit)
    if (!Number.isFinite(n) || n < 1 || n > 100000) return badRequest('apiRateLimit must be between 1 and 100000')
    body.apiRateLimit = Math.round(n)
  }
  if (body.defaultExpiry !== undefined && !EXPIRY_PRESETS.includes(String(body.defaultExpiry))) {
    return badRequest(`defaultExpiry must be one of ${EXPIRY_PRESETS.join(', ')}`)
  }
  for (const key of Object.keys(body)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) return badRequest(`Invalid setting key: ${key}`)
  }

  const before = await getSettings()
  await setSettings(body)
  // Only log keys that changed, and never write secrets into the audit log.
  const changedBefore: Record<string, unknown> = {}
  const changedAfter: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (JSON.stringify(before[k]) === JSON.stringify(v)) continue
    changedBefore[k] = SECRET_KEYS.has(k) ? '(redacted)' : before[k]
    changedAfter[k] = SECRET_KEYS.has(k) ? '(redacted)' : v
  }
  await auditLog(session.userId, 'update_settings', 'site_settings', 'singleton', {
    before: changedBefore,
    after: changedAfter,
  })
  const after = await getSettings()
  return ok('Settings updated', [after])
}
