import type { NextRequest } from 'next/server'
import { ok, notFound, gone } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import {
  toSafePaste,
  findPaste,
  checkPasteAccess,
  claimBurn,
  scheduleBurnDelete,
  recordView,
} from '@/lib/paste-access'

/**
 * GET /api/paste?id=<slug> — read one paste.
 *
 *   ?peek=1  metadata only: no content, no view counted, never burns. The UI
 *            uses it to show a "this paste will self-destruct" interstitial.
 *
 * Burn-after-read text pastes are burned by the first non-owner read (here,
 * /api/paste/[id] or /raw). File pastes are burned by the download in
 * /api/file, so this endpoint only returns their metadata.
 */
export async function readPaste(req: NextRequest, id: string) {
  const session = await getSession()
  const peek = new URL(req.url).searchParams.get('peek') === '1'

  const paste = await findPaste(id)
  if (!paste) return notFound('Paste not found')

  const access = await checkPasteAccess(req, paste, session)
  if (access.status === 'denied') return access.response
  if (access.status === 'password_required') {
    return ok('Password required', [
      { ...toSafePaste(paste, { includeContent: false }), passwordRequired: true },
    ])
  }

  const privileged = access.isOwner || access.isModerator
  const burnPending = paste.burnAfterRead && !privileged

  if (peek) {
    return ok('Paste metadata', [
      { ...toSafePaste(paste, { includeContent: false }), isOwner: access.isOwner, burnPending },
    ])
  }

  // Files: content is served by /api/file. Count the page view unless the
  // download will burn it (that request counts the single view instead).
  if (paste.contentType === 'file') {
    if (!burnPending && !privileged) await recordView(paste)
    return ok('Paste fetched', [
      { ...toSafePaste(paste, { includeContent: false }), isOwner: access.isOwner, burnPending },
    ])
  }

  if (burnPending) {
    if (!(await claimBurn(paste))) {
      return gone('Paste was burned after reading and is no longer available')
    }
    scheduleBurnDelete(paste.id)
    const safe = toSafePaste({ ...paste, viewCount: paste.viewCount + 1 }, { includeContent: true })
    return ok('Paste fetched (burned after read)', [{ ...safe, isBurned: true, isOwner: false }])
  }

  // Owners/moderators previewing their own paste don't inflate the counter.
  if (!privileged) await recordView(paste)
  return ok('Paste fetched', [
    { ...toSafePaste(paste, { includeContent: true }), isOwner: access.isOwner },
  ])
}


/**
 * Plain-text body of a text paste (or a redirect to the file download).
 * Used by GET /api/paste/raw?id= and the short /raw/<slug> URL. Applies the
 * same private/password/burn rules as the JSON endpoint — errors are plain
 * text so they read well in a terminal.
 */
export async function servePasteRaw(req: NextRequest, id: string): Promise<Response> {
  const text = (body: string, status: number) =>
    new Response(body + '\n', {
      status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })

  const session = await getSession()
  const paste = await findPaste(id)
  if (!paste) return text('Paste not found', 404)

  if (paste.contentType !== 'text') {
    const url = new URL(`/api/file?id=${encodeURIComponent(paste.slug)}`, req.url)
    return Response.redirect(url, 302)
  }

  const access = await checkPasteAccess(req, paste, session)
  if (access.status === 'denied') {
    const json = (await access.response.json().catch(() => ({}))) as { message?: string }
    return text(json.message || 'Access denied', access.response.status)
  }
  if (access.status === 'password_required') {
    return text(
      'Password required. Send it in the x-paste-password header, or POST /api/paste/unlock and pass the token as ?token=',
      403,
    )
  }

  const privileged = access.isOwner || access.isModerator
  if (paste.burnAfterRead && !privileged) {
    if (!(await claimBurn(paste))) return text('Paste was burned after reading', 410)
    scheduleBurnDelete(paste.id)
  } else if (!privileged) {
    await recordView(paste)
  }

  return new Response(paste.textContent || '', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      // ?dl=1 → save as a file named after the paste
      ...(new URL(req.url).searchParams.get('dl') === '1'
        ? { 'Content-Disposition': contentDisposition('attachment', downloadName(paste)) }
        : {}),
    },
  })
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js', typescript: 'ts', jsx: 'jsx', tsx: 'tsx', python: 'py', java: 'java',
  csharp: 'cs', cpp: 'cpp', c: 'c', go: 'go', rust: 'rs', ruby: 'rb', php: 'php', swift: 'swift',
  kotlin: 'kt', sql: 'sql', bash: 'sh', shell: 'sh', powershell: 'ps1', html: 'html', css: 'css',
  scss: 'scss', json: 'json', yaml: 'yml', xml: 'xml', markdown: 'md', dockerfile: 'Dockerfile',
  lua: 'lua', r: 'r', scala: 'scala', perl: 'pl', haskell: 'hs', elixir: 'ex', clojure: 'clj',
  dart: 'dart', 'objective-c': 'm', fsharp: 'fs', vb: 'vb', ini: 'ini', bat: 'bat',
  makefile: 'Makefile', graphql: 'graphql', solidity: 'sol', plaintext: 'txt',
}

/** File name used when downloading a text paste. */
export function downloadName(p: { slug: string; title: string | null; language: string }): string {
  const ext = LANGUAGE_EXTENSIONS[p.language] || 'txt'
  if (ext === 'Dockerfile' || ext === 'Makefile') return ext
  const base = (p.title || p.slug).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || p.slug
  return base.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? base : `${base}.${ext}`
}

/** RFC 6266 / 5987 Content-Disposition with a safe ASCII fallback. */
export function contentDisposition(kind: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}
