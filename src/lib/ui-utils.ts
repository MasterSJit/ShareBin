'use client'

/** Common languages for the Monaco editor language picker. */
export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'plaintext', label: 'Auto-detect' },
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
  { value: 'plaintext', label: 'Other / Plaintext' },
]

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
