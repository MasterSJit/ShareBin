import { NextRequest } from 'next/server'

// GET /p/<slug> — clean share URL. The app is a single-page client with hash
// routing, so hand off to /#/p/<slug>. (Fragments in Location are honoured
// by all browsers.)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  const safe = encodeURIComponent(slug.replace(/[^A-Za-z0-9_-]/g, ''))
  return new Response(null, {
    status: 302,
    headers: { Location: `/#/p/${safe}`, 'Cache-Control': 'no-store' },
  })
}
