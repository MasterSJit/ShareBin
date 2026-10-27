import { NextRequest } from 'next/server'
import { servePasteRaw } from '@/lib/paste-read'

// GET /api/paste/raw?id=<slug> — plain-text body (also available as /raw/<slug>)
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return new Response('id query param is required\n', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return servePasteRaw(req, id)
}
