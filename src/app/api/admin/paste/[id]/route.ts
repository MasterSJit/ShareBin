import { NextRequest } from 'next/server'

/**
 * /api/admin/paste/[id] — path-param form of /api/admin/paste.
 * Delegates so both forms share validation, hard-delete and audit logging.
 * (DELETE used to soft-delete here while /api/admin/paste hard-deleted.)
 */
async function withId(req: NextRequest, id: string): Promise<NextRequest> {
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    /* empty or invalid body — handler validates fields */
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
