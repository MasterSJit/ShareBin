'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2 } from 'lucide-react'
import { monacoLanguage } from '@/lib/ui-utils'

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
  /** Called on Ctrl/Cmd+Enter inside the editor (e.g. submit the form). */
  onSubmitShortcut?: () => void
}

type MonacoEditorInstance = {
  updateOptions: (opts: { readOnly: boolean }) => void
  addCommand: (keybinding: number, handler: () => void) => unknown
}
type MonacoApi = { KeyMod: { CtrlCmd: number }; KeyCode: { Enter: number } }

export function CodeEditor({
  value,
  onChange,
  language = 'plaintext',
  readOnly = false,
  height = 420,
  wordWrap = true,
  showLineNumbers = true,
  onSubmitShortcut,
}: Props) {
  const { resolvedTheme } = useTheme()
  const monacoTheme = resolvedTheme === 'light' ? 'light' : 'vs-dark'
  const [fullscreen, setFullscreen] = useState(false)
  const monacoLang = monacoLanguage(language)
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Keep the latest callback without re-registering the Monaco command.
  const submitRef = useRef(onSubmitShortcut)
  useEffect(() => {
    submitRef.current = onSubmitShortcut
  }, [onSubmitShortcut])

  // Esc leaves fullscreen.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  function handleMount(editor: MonacoEditorInstance, monaco: MonacoApi) {
    editor.updateOptions({ readOnly })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submitRef.current?.())
  }

  const heightCss = fullscreen ? 'calc(100vh - 3.5rem)' : (typeof height === 'number' ? `${height}px` : height)

  return (
    <>
      {fullscreen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          {/* Fullscreen top bar */}
          <div className="terminal-strip flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{language}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                {readOnly ? 'read-only' : 'editing'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullscreen(false)}
              className="gap-1.5"
            >
              <Minimize2 className="h-4 w-4" /> Exit fullscreen
            </Button>
          </div>
          {/* Editor fills remaining space */}
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language={monacoLang}
              theme={monacoTheme}
              value={value}
              onChange={(v) => onChange?.(v)}
              onMount={handleMount as never}
              options={{
                readOnly,
                minimap: { enabled: true },
                fontSize: 14,
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
                padding: { top: 16, bottom: 16 },
                scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
              }}
            />
          </div>
        </div>
      )}

      <div className="relative" style={{ height: heightCss, width: '100%', overflow: 'hidden' }}>
        <MonacoEditor
          height={heightCss}
          language={monacoLang}
          theme={monacoTheme}
          value={value}
          onChange={(v) => onChange?.(v)}
          onMount={handleMount as never}
          options={{
            readOnly,
            minimap: { enabled: !readOnly && wide },
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
        {/* Fullscreen toggle button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setFullscreen(true)}
          className="absolute right-2 top-2 z-10 h-7 w-7 bg-background/80 text-muted-foreground hover:text-foreground"
          title={readOnly ? 'Fullscreen' : 'Fullscreen editor'}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </>
  )
}
