import { NextRequest } from 'next/server'
import { servePasteRaw } from '@/lib/paste-read'

// GET /raw/<slug> — short, shareable raw URL (`curl https://host/raw/abc123`)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  return servePasteRaw(req, slug)
}
