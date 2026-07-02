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
  height?: string | number
  wordWrap?: boolean
  showLineNumbers?: boolean
}

export function CodeEditor({
  value,
  onChange,
  language = 'plaintext',
  readOnly = false,
  height = '100%',
  wordWrap = true,
  showLineNumbers = true,
}: Props) {
  const { resolvedTheme } = useTheme()
  const monacoTheme = resolvedTheme === 'light' ? 'light' : 'vs-dark'

  function handleMount(editor: { updateOptions: (opts: { readOnly: boolean }) => void }) {
    // Ensure readOnly flag is applied after mount (Monaco quirk)
    editor.updateOptions({ readOnly })
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <MonacoEditor
        height={height}
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
