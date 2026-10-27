import { NextRequest, NextResponse } from 'next/server'
import { getSettings } from '@/lib/paste-utils'

/**
 * API gateway (Next.js 16 "proxy", formerly middleware) for /api/*:
 *
 *  - CORS: cross-origin requests are allowed only from `apiCorsOrigins`
 *    (comma list or `*`). Credentials are never allowed cross-origin, so
 *    browser sessions can't be ridden from another site — external callers
 *    authenticate with an API key instead.
 *  - API keys (`x-api-key` / `Authorization: Bearer ps_…`): rejected when
 *    `apiEnabled` is off, and rate-limited to `apiRateLimit` requests/minute
 *    per key (429 + Retry-After).
 */

const ALLOWED_HEADERS = 'content-type, x-api-key, authorization, x-unlock-token, x-paste-password'
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const WINDOW_MS = 60_000

const buckets = new Map<string, number[]>()

function hitLimit(key: string, max: number): { limited: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  const fresh = (buckets.get(key) ?? []).filter((t) => t > now - WINDOW_MS)
  if (fresh.length >= max) {
    buckets.set(key, fresh)
    return { limited: true, remaining: 0, retryAfter: Math.ceil((fresh[0] + WINDOW_MS - now) / 1000) }
  }
  fresh.push(now)
  buckets.set(key, fresh)
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.length || v[v.length - 1] < now - WINDOW_MS) buckets.delete(k)
  }
  return { limited: false, remaining: max - fresh.length, retryAfter: 0 }
}

function apiKeyOf(req: NextRequest): string | null {
  const direct = req.headers.get('x-api-key')
  if (direct) return direct.trim()
  const auth = req.headers.get('authorization')
  if (auth && /^bearer\s+ps_/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim()
  return null
}

function corsAllowed(origin: string, setting: unknown): boolean {
  const list = typeof setting === 'string' ? setting.split(',').map((s) => s.trim()).filter(Boolean) : []
  return list.includes('*') || list.includes(origin)
}

function json(status: number, message: string, headers: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify({ message, data: [] }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export async function proxy(req: NextRequest) {
  let settings: Record<string, unknown> = {}
  try {
    settings = await getSettings()
  } catch {
    // DB unavailable — don't block the request here; the route will report it.
    return NextResponse.next()
  }

  const origin = req.headers.get('origin')
  const sameOrigin = !origin || origin === req.nextUrl.origin
  const cors: Record<string, string> = {}
  if (!sameOrigin && corsAllowed(origin!, settings.apiCorsOrigins)) {
    cors['Access-Control-Allow-Origin'] = origin!
    cors['Vary'] = 'Origin'
    cors['Access-Control-Expose-Headers'] = 'X-Total-Count, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After'
  }

  if (req.method === 'OPTIONS') {
    if (sameOrigin || !cors['Access-Control-Allow-Origin']) return new NextResponse(null, { status: 204 })
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': '600',
      },
    })
  }

  const key = apiKeyOf(req)
  const rateHeaders: Record<string, string> = {}
  if (key) {
    if (settings.apiEnabled === false) return json(403, 'API access is disabled on this site', cors)
    const limit = Math.max(1, Number(settings.apiRateLimit) || 60)
    const r = hitLimit(key, limit)
    rateHeaders['X-RateLimit-Limit'] = String(limit)
    rateHeaders['X-RateLimit-Remaining'] = String(r.remaining)
    if (r.limited) {
      return json(429, `API rate limit exceeded (${limit} requests/minute)`, {
        ...cors,
        ...rateHeaders,
        'Retry-After': String(r.retryAfter),
      })
    }
  }

  const res = NextResponse.next()
  for (const [k, v] of Object.entries({ ...cors, ...rateHeaders })) res.headers.set(k, v)
  return res
}

export const config = {
  matcher: ['/api/:path*'],
}
