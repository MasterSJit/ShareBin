'use client'

/** Common languages for the Monaco editor language picker. */
export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'shell', label: 'Shell Script' },
  { value: 'lua', label: 'Lua' },
  { value: 'r', label: 'R' },
  { value: 'scala', label: 'Scala' },
  { value: 'perl', label: 'Perl' },
  { value: 'haskell', label: 'Haskell' },
  { value: 'elixir', label: 'Elixir' },
  { value: 'clojure', label: 'Clojure' },
  { value: 'dart', label: 'Dart' },
  { value: 'objective-c', label: 'Objective-C' },
  { value: 'fsharp', label: 'F#' },
  { value: 'vb', label: 'Visual Basic' },
  { value: 'ini', label: 'INI / Config' },
  { value: 'bat', label: 'Batch' },
  { value: 'makefile', label: 'Makefile' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'solidity', label: 'Solidity' },
  { value: 'protobuf', label: 'Protocol Buffers' },
  { value: 'julia', label: 'Julia' },
  { value: 'hcl', label: 'HCL / Terraform' },
  { value: 'diff', label: 'Diff / Patch' },
]

/** Human label for a language id (falls back to the id itself). */
export function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label || value
}

/**
 * Map our language ids to Monaco's. Monaco has no `bash`, `jsx`, `tsx`,
 * `haskell`, `makefile` or `diff` modes; unknown ids render as plaintext.
 */
const MONACO_ALIASES: Record<string, string> = {
  bash: 'shell',
  jsx: 'javascript',
  tsx: 'typescript',
  haskell: 'plaintext',
  makefile: 'plaintext',
  diff: 'plaintext',
  solidity: 'sol',
}

export function monacoLanguage(value: string | undefined | null): string {
  if (!value) return 'plaintext'
  return MONACO_ALIASES[value] ?? value
}

/**
 * Best-effort language detection for pasted text. Cheap regex scoring —
 * good enough to pre-select the highlighter; the user can always override.
 */
export function detectLanguage(text: string): string {
  const src = text.slice(0, 20_000)
  const t = src.trim()
  if (!t) return 'plaintext'

  // Shebangs are decisive.
  const shebang = /^#!.*\b(python[0-9.]*|node|deno|bun|bash|sh|zsh|ruby|perl|php|pwsh)\b/.exec(t)
  if (shebang) {
    const i = shebang[1]
    if (i.startsWith('python')) return 'python'
    if (i === 'node' || i === 'deno' || i === 'bun') return 'javascript'
    if (i === 'ruby') return 'ruby'
    if (i === 'perl') return 'perl'
    if (i === 'php') return 'php'
    if (i === 'pwsh') return 'powershell'
    return 'bash'
  }
  if ((t.startsWith('{') || t.startsWith('[')) && t.length < 2_000_000) {
    try {
      JSON.parse(t)
      return 'json'
    } catch {
      /* not JSON */
    }
  }
  if (/^<\?php/.test(t)) return 'php'
  if (/^<\?xml/.test(t)) return 'xml'
  if (/^<!doctype html|^<html[\s>]/i.test(t)) return 'html'
  if (/^(diff --git|--- a\/|\+\+\+ b\/|@@ -\d)/m.test(t) && /^[+-]/m.test(t)) return 'diff'
  if (/^FROM\s+\S+/m.test(t) && /^(RUN|CMD|COPY|ENTRYPOINT|WORKDIR)\s/m.test(t)) return 'dockerfile'

  const rules: [string, RegExp, number][] = [
    ['python', /^\s*def \w+\(.*\)\s*(->\s*[\w\[\], .]+)?:\s*$/m, 4],
    ['python', /^\s*(from [\w.]+ )?import [\w., ]+$/m, 1],
    ['python', /^\s*(elif|except|with .* as \w+):|\bself\.|__name__ == ['"]__main__['"]|print\(/m, 2],
    ['go', /^package \w+$|^func (\(\w+ \*?\w+\) )?\w+\(|:= /m, 3],
    ['rust', /\bfn \w+\(|\blet mut\b|\bimpl\b.*\{|println!\(|::<|->\s*Result</m, 3],
    ['java', /\bpublic (static )?(class|void|interface)\b|System\.out\.println|@Override/m, 3],
    ['csharp', /\busing System(\.\w+)*;|\bnamespace [\w.]+|Console\.WriteLine|\{ get; set; \}/m, 3],
    ['cpp', /#include\s*<(iostream|vector|string|map|memory)>|std::|cout\s*<<|template\s*</m, 3],
    ['c', /#include\s*<(stdio|stdlib|string|unistd)\.h>|\bprintf\(|\bmalloc\(/m, 3],
    ['php', /\$\w+\s*=.*;|->\w+\(|echo\s+\$/m, 1],
    ['ruby', /^\s*(def \w+[?!]?(\(.*\))?|end|require ['"]\w+['"]|puts .*)$/m, 1],
    ['kotlin', /\bfun \w+\(|\bval \w+(: \w+)? =|println\(/m, 2],
    ['swift', /\bimport (SwiftUI|UIKit|Foundation)\b|\bfunc \w+\(.*\) -> |\bguard let\b/m, 3],
    ['typescript', /\binterface \w+\s*\{|:\s*(string|number|boolean|void|unknown)\b|\btype \w+ = |\bas const\b|<[A-Z]\w*>\(/m, 2],
    ['javascript', /\b(const|let|var) \w+ = |=>|console\.log\(|\bfunction\s*\w*\(|require\(['"]|module\.exports|export (default|const|function)/m, 1],
    ['sql', /^\s*(SELECT\s.+\sFROM|INSERT INTO|UPDATE \w+ SET|DELETE FROM|CREATE (TABLE|INDEX|VIEW)|ALTER TABLE)\b/im, 4],
    ['css', /^\s*[.#@]?[\w-:]+(\s*[,>+~]\s*[.#]?[\w-:]+)*\s*\{\s*$|^\s*[\w-]+\s*:\s*[^;{}]+;\s*$/m, 1],
    ['html', /<\/?(div|span|p|a|body|head|script|style|section|ul|li|table)[\s>]/i, 2],
    ['bash', /^\s*(if \[|fi$|then$|done$|echo |export \w+=|sudo |apt(-get)? |cd |\$\(|for \w+ in )/m, 2],
    ['powershell', /\b(Write-Host|Get-\w+|Set-\w+|\$env:|-ErrorAction)\b/m, 3],
    ['yaml', /^(---\s*$|\s*[\w-]+:\s*(\S.*)?$|\s*- \S)/m, 1],
    ['markdown', /^#{1,6} \S|^\s*[-*] \[[ x]\] |^```|\[[^\]]+\]\([^)]+\)/m, 2],
    ['lua', /\blocal function\b|\blocal \w+ = |\bthen\b[\s\S]*\bend\b/m, 2],
  ]
  const scores: Record<string, number> = {}
  for (const [lang, re, weight] of rules) {
    const matches = src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))
    if (matches) scores[lang] = (scores[lang] ?? 0) + weight * Math.min(matches.length, 5)
  }
  // YAML/markdown/css heuristics fire on lots of things; damp them when
  // code-ish punctuation is present.
  if (/[;{}()]/.test(src)) {
    if (scores.yaml) scores.yaml *= 0.3
    if (scores.markdown) scores.markdown *= 0.5
  }
  if (scores.typescript && scores.javascript) scores.typescript += scores.javascript
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return best && best[1] >= 3 ? best[0] : 'plaintext'
}

export const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: '10m', label: '10 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
  { value: '1w', label: '1 week' },
  { value: '1M', label: '1 month' },
  { value: '1y', label: '1 year' },
  { value: 'custom', label: 'Custom…' },
]

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  const abs = Math.abs(diff)
  const future = diff > 0
  const min = 60 * 1000
  const hr = 60 * min
  const day = 24 * hr
  const wk = 7 * day
  const mon = 30 * day
  const yr = 365 * day
  let value: number
  let unit: string
  if (abs < min) return 'just now'
  if (abs < hr) { value = Math.floor(abs / min); unit = 'minute' }
  else if (abs < day) { value = Math.floor(abs / hr); unit = 'hour' }
  else if (abs < wk) { value = Math.floor(abs / day); unit = 'day' }
  else if (abs < mon) { value = Math.floor(abs / wk); unit = 'week' }
  else if (abs < yr) { value = Math.floor(abs / mon); unit = 'month' }
  else { value = Math.floor(abs / yr); unit = 'year' }
  const s = value === 1 ? '' : 's'
  return future ? `in ${value} ${unit}${s}` : `${value} ${unit}${s} ago`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}
