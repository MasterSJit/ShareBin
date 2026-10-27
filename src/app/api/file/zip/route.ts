import { NextRequest } from 'next/server'
import { ok, badRequest, forbidden, notFound, unprocessable } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { findPaste, checkPasteAccess } from '@/lib/paste-access'
import { contentDisposition } from '@/lib/paste-read'
import { getStorage } from '@/lib/storage'
import { listZip, extractZipEntry, ZipError, MAX_LISTED_ENTRIES } from '@/lib/zip'

/**
 * GET /api/file/zip?id=<slug>                 → list the archive's entries
 * GET /api/file/zip?id=<slug>&entry=<path>    → extract & download one entry
 *
 * Same access rules as /api/file (private / password). Not available for
 * burn-after-read files — browsing them would reveal content without burning.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const entryName = searchParams.get('entry')
  if (!id) return badRequest('id is required')

  const session = await getSession()
  const paste = await findPaste(id)
  if (!paste) return notFound('File not found')
  if (paste.contentType !== 'file' || !paste.storageKey) return badRequest('Not a file paste')

  const access = await checkPasteAccess(req, paste, session)
  if (access.status === 'denied') return access.response
  if (access.status === 'password_required') return forbidden('Password required — POST /api/paste/unlock first')
  if (paste.burnAfterRead && !access.isOwner && !access.isModerator) {
    return forbidden('Archive browsing is disabled for burn-after-read files')
  }

  const storage = getStorage()
  try {
    const { entries, total } = await listZip(storage, paste.storageKey, paste.fileSizeBytes ?? 0)

    if (!entryName) {
      return ok('Archive entries', [
        {
          total,
          truncated: total > entries.length,
          limit: MAX_LISTED_ENTRIES,
          entries: entries.map(({ offset: _offset, ...e }) => e),
        },
      ])
    }

    const entry = entries.find((e) => e.name === entryName)
    if (!entry) return notFound('Entry not found in archive')
    const data = await extractZipEntry(storage, paste.storageKey, entry)
    const baseName = entry.name.split('/').filter(Boolean).pop() || 'file'
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        // Always a download, never rendered: entries are arbitrary content.
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDisposition('attachment', baseName),
        'Content-Length': String(data.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    if (e instanceof ZipError) return unprocessable(e.message)
    throw e
  }
}
