import { NextRequest } from 'next/server'
import { ok, unauthorized, forbidden, badRequest } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { getSettings, setSettings } from '@/lib/paste-utils'
import { auditLog } from '@/lib/paste-utils'

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
  if (body.guestPostingEnabled !== undefined) body.guestPostingEnabled = !!body.guestPostingEnabled
  if (body.sitemapEnabled !== undefined) body.sitemapEnabled = !!body.sitemapEnabled

  const before = await getSettings()
  await setSettings(body)
  await auditLog(session.userId, 'update_settings', 'site_settings', 'singleton', { before, after: body })
  const after = await getSettings()
  return ok('Settings updated', [after])
}
