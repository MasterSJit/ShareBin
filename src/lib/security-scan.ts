/**
 * Spam / malware scanner for pastes & file uploads.
 *
 * Pure synchronous functions — the caller fetches site settings once
 * (e.g. `bannedWords`) and passes them via the options bag so the
 * scanner never has to await the DB on every call.
 *
 * Returned threat identifiers are stable machine-readable strings
 * (e.g. `xss_script_tag`, `sql_injection`, `spam_excess_repetition`,
 * `banned_word`, `suspicious_double_extension`, `executable_mime`,
 * `executable_magic_bytes`, `macro_enabled_office`).
 */

export type ScanResult = {
  safe: boolean
  threats: string[]
}

export type TextScanOptions = {
  /** Lower-cased banned words/phrases to reject in body text. */
  bannedWords?: readonly string[]
  /** Pastes longer than this many characters are scanned for repetition. */
  repetitionThreshold?: number
}

// ---- Patterns --------------------------------------------------------------

// <script>...</script> (case-insensitive, allows whitespace/attrs)
const SCRIPT_TAG_RE = /<\s*script\b[^>]*>/i
// javascript: URL prefix in href/src (allows whitespace & quotes)
const JS_URL_RE = /(?:href|src|action|formaction|data|background)\s*=\s*["'`]?\s*(?:javascript|vbscript|livescript)\s*:/i
// Inline on* event handlers — onerror=, onload=, onclick=, etc.
const ON_EVENT_RE = /\son[a-z]+\s*=\s*["'`]?[^"'`\s>]/i
// SQL injection signatures
const SQL_UNION_RE = /\bunion\b\s+\bselect\b/i
const SQL_OR_TRUE_RE = /'\s*(?:or|and)\s+(?:1\s*=\s*1|true|'1'\s*=\s*'1')/i
const SQL_COMMENT_RE = /(?:--|\/\*|\*\/|#)/
const SQL_DROP_RE = /\b(?:drop|truncate|alter|create)\s+(?:table|database|index|view)\b/i
// PHP eval / shell injection
const PHP_EVAL_RE = /\b(?:eval|assert|system|exec|shell_exec|passthru|proc_open|popen)\s*\(/

const THREAT_PATTERNS: ReadonlyArray<{ threat: string; re: RegExp }> = [
  { threat: 'xss_script_tag', re: SCRIPT_TAG_RE },
  { threat: 'xss_javascript_url', re: JS_URL_RE },
  { threat: 'xss_event_handler', re: ON_EVENT_RE },
  { threat: 'sql_injection_union', re: SQL_UNION_RE },
  { threat: 'sql_injection_or', re: SQL_OR_TRUE_RE },
  { threat: 'sql_injection_comment', re: SQL_COMMENT_RE },
  { threat: 'sql_injection_ddl', re: SQL_DROP_RE },
  { threat: 'code_injection_eval', re: PHP_EVAL_RE },
]

// Executable / dangerous MIME types
const EXECUTABLE_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/x-executable',
  'application/x-msdownload',
  'application/x-dosexec',
  'application/x-msi',
  'application/x-elf',
  'application/x-sharedlib',
  'application/x-shellscript',
  'application/x-bat',
  'application/x-csh',
  'application/x-perl',
  'application/x-python',
  'application/x-ruby',
  'application/java-archiver',
  'application/java-vm',
  'application/x-shockwave-flash',
])

// Banned file extensions (lower-case, no dot)
const BANNED_EXTENSIONS: ReadonlySet<string> = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'scr',
  'msi',
  'vbs',
  'ps1',
  'sh',
  'so',
  'dll',
  'app',
  'jar',
  'class',
  'action',
  'bin',
  'com',
  'cpl',
  'gadget',
  'inf',
  'hta',
  'isp',
  'jse',
  'lnk',
  'msc',
  'msp',
  'pif',
  'reg',
  'sct',
  'vb',
  'vbe',
  'wsf',
  'wsh',
])

// Magic bytes for executable / dangerous file formats
const MAGIC_BYTES: ReadonlyArray<{ threat: string; bytes: number[] }> = [
  { threat: 'executable_mz', bytes: [0x4d, 0x5a] }, // DOS / PE (Windows .exe/.dll)
  { threat: 'executable_elf', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // ELF (Linux)
  { threat: 'executable_macho_64', bytes: [0xcf, 0xfa, 0xed, 0xfe] }, // Mach-O 64
  { threat: 'executable_macho_32', bytes: [0xce, 0xfa, 0xed, 0xfe] }, // Mach-O 32
  { threat: 'executable_java_class', bytes: [0xca, 0xfe, 0xba, 0xbe] }, // Java .class
]

// ---- Helpers ---------------------------------------------------------------

function splitExt(name: string): string[] {
  // Returns the list of extensions (without dots, lower-cased) in order.
  // e.g. "archive.tar.gz" -> ["tar","gz"], "file" -> []
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return []
  return name
    .slice(idx + 1)
    .split('.')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function countRepetition(content: string): { maxRun: number; ratio: number } {
  if (!content) return { maxRun: 0, ratio: 0 }
  let maxRun = 1
  let cur = 1
  for (let i = 1; i < content.length; i++) {
    if (content[i] === content[i - 1]) {
      cur++
      if (cur > maxRun) maxRun = cur
    } else {
      cur = 1
    }
  }
  const ratio = maxRun / content.length
  return { maxRun, ratio }
}

// ---- Public API ------------------------------------------------------------

/**
 * Scan text content (paste bodies, titles, etc.) for spam/malware signatures.
 *
 * @param content  The raw user-supplied text.
 * @param opts     Optional configuration — banned words, repetition threshold.
 */
export function scanTextContent(
  content: string,
  opts: TextScanOptions = {},
): ScanResult {
  const threats: string[] = []
  const text = content ?? ''

  // 1. Known malicious patterns (XSS, SQLi, code injection)
  for (const { threat, re } of THREAT_PATTERNS) {
    if (re.test(text)) threats.push(threat)
  }

  // 2. Banned words
  const banned = opts.bannedWords ?? []
  if (banned.length > 0) {
    const lower = text.toLowerCase()
    for (const w of banned) {
      const word = (w || '').trim().toLowerCase()
      if (word && lower.includes(word)) {
        threats.push('banned_word')
        break // one is enough
      }
    }
  }

  // 3. Excessive repetition (spam indicator)
  //    Trigger when a single character repeats >1000 times AND >40% of body.
  const threshold = opts.repetitionThreshold ?? 1000
  if (text.length > threshold) {
    const { maxRun, ratio } = countRepetition(text)
    if (maxRun > threshold && ratio > 0.4) {
      threats.push('spam_excess_repetition')
    }
  }

  return { safe: threats.length === 0, threats }
}

/**
 * Scan a file name + MIME type for suspicious indicators.
 *
 * @param fileName  Original file name (e.g. "report.pdf").
 * @param mimeType  MIME type from the upload (may be empty / untrusted).
 */
export function scanFileName(fileName: string, mimeType: string): ScanResult {
  const threats: string[] = []
  const name = (fileName || '').trim()
  const mime = (mimeType || '').trim().toLowerCase()

  // 1. Double / chained extensions where the last is benign but a hidden
  //    executable extension sits in the middle: file.exe.jpg, invoice.pdf.exe
  const exts = splitExt(name)
  if (exts.length >= 2) {
    const middle = exts.slice(0, -1)
    if (middle.some((e) => BANNED_EXTENSIONS.has(e))) {
      threats.push('suspicious_double_extension')
    }
  } else if (exts.length === 1 && BANNED_EXTENSIONS.has(exts[0])) {
    threats.push('banned_extension')
  }

  // 2. Executable MIME types
  if (mime && EXECUTABLE_MIME_TYPES.has(mime)) {
    threats.push('executable_mime')
  }

  // 3. MIME / extension mismatch where the extension is executable but
  //    the MIME is benign — a common disguise trick.
  if (exts.length > 0 && BANNED_EXTENSIONS.has(exts[exts.length - 1])) {
    if (mime && !EXECUTABLE_MIME_TYPES.has(mime) && mime !== 'application/octet-stream') {
      threats.push('mime_extension_mismatch')
    }
  }

  // 4. Suspicious name patterns — null bytes, path separators, leading dots.
  if (/[\\/\u0000]/.test(name) || name.startsWith('..') || name.includes('\u0000')) {
    threats.push('suspicious_filename')
  }

  return { safe: threats.length === 0, threats }
}

/**
 * Scan raw file bytes for malware signatures (magic bytes, embedded scripts,
 * macro-enabled Office documents).
 *
 * @param buf       File bytes.
 * @param mimeType  Declared MIME type.
 */
export function scanFileContent(buf: Buffer, mimeType: string): ScanResult {
  const threats: string[] = []
  if (!buf || buf.length === 0) return { safe: true, threats }

  // 1. Executable magic bytes (MZ, ELF, Mach-O, Java class)
  for (const { threat, bytes } of MAGIC_BYTES) {
    if (buf.length >= bytes.length) {
      let match = true
      for (let i = 0; i < bytes.length; i++) {
        if (buf[i] !== bytes[i]) {
          match = false
          break
        }
      }
      if (match) {
        threats.push(threat)
      }
    }
  }

  // 2. Macro-enabled Office documents
  //    .docm / .xlsm / .pptm / .dotm — flagged via MIME or zip-based detection.
  const mime = (mimeType || '').toLowerCase()
  const MACRO_MIMES = new Set([
    'application/vnd.ms-word.document.macroEnabled.12',
    'application/vnd.ms-word.template.macroEnabled.12',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  ])
  if (MACRO_MIMES.has(mime)) {
    threats.push('macro_enabled_office')
  }
  // Office files are ZIP archives starting with PK\x03\x04; check for vbaProject.bin inside
  if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    // Cheap heuristic: search the raw bytes for the vbaProject.bin signature
    const needle = Buffer.from('vbaProject.bin', 'utf8')
    if (buf.indexOf(needle) !== -1) {
      threats.push('macro_enabled_office')
    }
  }

  // 3. <script> tags inside non-script text files
  //    (text/html, text/xml, application/xhtml, image/svg+xml)
  if (
    mime.startsWith('text/') ||
    mime === 'image/svg+xml' ||
    mime === 'application/xhtml+xml' ||
    mime === 'application/xml'
  ) {
    const head = buf.subarray(0, Math.min(buf.length, 64 * 1024)).toString('utf8')
    if (SCRIPT_TAG_RE.test(head)) threats.push('embedded_script_tag')
    if (JS_URL_RE.test(head)) threats.push('embedded_javascript_url')
    if (ON_EVENT_RE.test(head)) threats.push('embedded_event_handler')
  }

  return { safe: threats.length === 0, threats }
}

/**
 * Convenience: combine a list of ScanResult objects into one.
 * Useful when scanning text + filename in a single upload.
 */
export function mergeScanResults(results: ScanResult[]): ScanResult {
  const threats: string[] = []
  for (const r of results) threats.push(...r.threats)
  // de-duplicate while preserving order
  const seen = new Set<string>()
  const unique = threats.filter((t) => {
    if (seen.has(t)) return false
    seen.add(t)
    return true
  })
  return { safe: unique.length === 0, threats: unique }
}
