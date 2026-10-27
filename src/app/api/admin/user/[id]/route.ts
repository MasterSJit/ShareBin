import { NextRequest } from 'next/server'

/**
 * /api/admin/user/[id] — path-param form of /api/admin/user.
 * Delegates to the body-id handlers so both forms share validation,
 * session invalidation and audit logging.
 */
async function withId(req: NextRequest, id: string): Promise<NextRequest> {
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    /* fall through with empty body; handler reports invalid JSON fields */
  }
  return new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify({ ...body, id }),
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { PATCH: handler } = await import('../route')
  return handler(await withId(req, id))
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { DELETE: handler } = await import('../route')
  return handler(await withId(req, id))
}
