import { NextRequest } from 'next/server'
import { readPaste } from '@/lib/paste-read'

// GET /api/paste/[id] — same as /api/paste?id=<id> (supports ?peek=1)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  return readPaste(req, id)
}
