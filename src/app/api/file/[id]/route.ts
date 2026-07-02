import { NextRequest } from 'next/server'
import { badRequest } from '@/lib/api-response'

// /api/file/[id] is not supported — file routes use query params only
// (file responses stream bytes, so we keep them on a single route).
export async function GET() {
  return badRequest('Use GET /api/file?id=<slug>&meta=1 for metadata, or /api/file?id=<slug> for download')
}
