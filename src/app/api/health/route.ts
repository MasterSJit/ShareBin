import { db } from '@/lib/db'

// GET /api/health — liveness/readiness probe for load balancers and uptime checks.
export async function GET() {
  const started = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json(
      { status: 'ok', db: 'ok', latencyMs: Date.now() - started, time: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return Response.json(
      { status: 'error', db: 'unreachable', error: (e as Error).message },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
