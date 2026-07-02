'use client'

import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Skeleton } from '@/components/ui/skeleton'

// Monaco is heavy + browser-only — load on demand.
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

type Props = {
  value: string
  onChange?: (v: string | undefined) => void
  language?: string
  readOnly?: boolean
  /** Height in px (number) or CSS string. Defaults to 420px — NOT '100%' */
  height?: string | number
  wordWrap?: boolean
  showLineNumbers?: boolean
}

export function CodeEditor({
  value,
  onChange,
  language = 'plaintext',
  readOnly = false,
  height = 420,
  wordWrap = true,
  showLineNumbers = true,
}: Props) {
  const { resolvedTheme } = useTheme()
  const monacoTheme = resolvedTheme === 'light' ? 'light' : 'vs-dark'

  function handleMount(editor: { updateOptions: (opts: { readOnly: boolean }) => void }) {
    // Ensure readOnly flag is applied after mount (Monaco quirk)
    editor.updateOptions({ readOnly })
  }

  // Normalize height to a CSS string the Monaco container can use directly.
  const heightCss = typeof height === 'number' ? `${height}px` : height

  return (
    <div style={{ height: heightCss, width: '100%', overflow: 'hidden' }}>
      <MonacoEditor
        height={heightCss}
        language={language === 'plaintext' ? 'plaintext' : language}
        theme={monacoTheme}
        value={value}
        onChange={(v) => onChange?.(v)}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: !readOnly },
          fontSize: 13,
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontLigatures: true,
          lineNumbers: showLineNumbers ? 'on' : 'off',
          wordWrap: wordWrap ? 'on' : 'off',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'selection',
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        }}
      />
    </div>
  )
}
