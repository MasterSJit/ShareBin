'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Check,
  Copy,
  FileCode,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { Reveal, scaleIn } from '@/components/motion-helpers'
import type { SafeUser } from '@/lib/types'

type Mode = 'login' | 'register'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const INPUT_CLASS =
  'bg-surface-3 border-border rounded-md focus-visible:ring-brand text-sm'

export function AuthView({ mode }: { mode: Mode }) {
  const { goLogin, goRegister } = useAppStore()
  const isLogin = mode === 'login'

  function onTabChange(v: 'login' | 'register') {
    if (v === 'login') goLogin()
    else goRegister()
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <Reveal variant={scaleIn} className="w-full max-w-md">
        <div className="surface glow-brand overflow-hidden rounded-2xl">
          {/* Terminal strip */}
          <div className="terminal-strip flex h-10 items-center gap-2 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              pasteshare — auth
            </span>
          </div>

          {/* Card body */}
          <div className="p-6">
            {/* Brand mark */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                <FileCode className="h-5 w-5" />
                <span className="brand-dot absolute -right-0.5 -top-0.5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight">
                  Paste<span className="text-brand">Share</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </p>
              </div>
            </div>

            {/* Underline tabs */}
            <div className="mt-6 flex gap-6 border-b border-border">
              <TabButton active={isLogin} onClick={() => onTabChange('login')}>
                Log in
              </TabButton>
              <TabButton active={!isLogin} onClick={() => onTabChange('register')}>
                Sign up
              </TabButton>
            </div>

            {/* Form */}
            <div className="mt-6">
              {isLogin ? <LoginForm /> : <RegisterForm />}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}

/* ---------------- Helpers ---------------- */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
        active
          ? 'border-brand text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </Label>
  )
}

function ShakeError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <motion.p
      initial={{ x: 0 }}
      animate={{ x: [0, -6, 6, -4, 4, 0] }}
      transition={{ duration: 0.35 }}
      className="mt-1.5 text-xs font-medium text-destructive"
    >
      {message}
    </motion.p>
  )
}

function FormError({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ x: 0 }}
      animate={{ x: [0, -6, 6, -4, 4, 0] }}
      transition={{ duration: 0.35 }}
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
    >
      {message}
    </motion.div>
  )
}

function FieldWrap({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      <ShakeError message={error} />
    </div>
  )
}

function DemoHint({ onFill }: { onFill: () => void }) {
  return (
    <div className="surface-3 flex items-center gap-2 rounded-md p-3 text-xs">
      <span className="brand-dot shrink-0" />
      <span className="flex-1 text-muted-foreground">
        Demo admin:{' '}
        <code className="font-mono text-foreground">admin@pasteshare.local</code> /{' '}
        <code className="font-mono text-foreground">admin123</code>
      </span>
      <button
        type="button"
        onClick={onFill}
        className="rounded-md border border-brand/40 px-2 py-1 text-[11px] font-medium text-brand transition-colors hover:bg-brand/10"
      >
        Fill
      </button>
    </div>
  )
}

function SubmitButton({
  submitting,
  children,
  icon,
}: {
  submitting: boolean
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="btn-shine flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}

/* ---------------- Login ---------------- */

function LoginForm() {
  const { setUser, goHome } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{
    email?: string
    password?: string
    form?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  function validate() {
    const e: typeof errors = {}
    if (!email) e.email = 'Email is required.'
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email address.'
    if (!password) e.password = 'Password is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setErrors({})
    try {
      const rows = await api.login(email, password)
      const u = rows[0] as SafeUser | undefined
      if (u) {
        setUser(u)
        toast.success('Welcome back')
        goHome()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setErrors({ form: 'Invalid email or password.' })
        else if (err.status === 429)
          setErrors({ form: 'Too many attempts. Wait a minute.' })
        else setErrors({ form: err.message || 'Login failed.' })
      } else {
        setErrors({ form: 'Network error. Try again.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function fillDemo() {
    setEmail('admin@pasteshare.local')
    setPassword('admin123')
    setErrors({})
    toast.info('Demo credentials filled')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {errors.form && <FormError message={errors.form} />}

      <FieldWrap id="login-email" label="Email" error={errors.email}>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            className={`${INPUT_CLASS} pl-9`}
          />
        </div>
      </FieldWrap>

      <FieldWrap id="login-password" label="Password" error={errors.password}>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          className={INPUT_CLASS}
        />
      </FieldWrap>

      <SubmitButton submitting={submitting} icon={<LogIn className="h-4 w-4" />}>
        Log in
      </SubmitButton>

      <button
        type="button"
        onClick={() => setShowForgot((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand"
      >
        <KeyRound className="h-3 w-3" /> Forgot password?
      </button>

      {showForgot && <ForgotPasswordBlock onDone={() => setShowForgot(false)} />}

      <DemoHint onFill={fillDemo} />
    </form>
  )
}

/* ---------------- Register ---------------- */

function RegisterForm() {
  const { setUser, goHome } = useAppStore()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{
    displayName?: string
    email?: string
    password?: string
    confirm?: string
    form?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const e: typeof errors = {}
    if (!email) e.email = 'Email is required.'
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email address.'
    if (!password) e.password = 'Password is required.'
    else if (password.length < 8)
      e.password = 'Password must be at least 8 characters.'
    if (confirm !== password) e.confirm = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setErrors({})
    try {
      const rows = await api.register(email, password, displayName || undefined)
      const u = rows[0] as SafeUser | undefined
      if (u) {
        setUser(u)
        toast.success('Account created')
        goHome()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setErrors({ form: 'Email already registered.' })
        else setErrors({ form: err.message || 'Registration failed.' })
      } else {
        setErrors({ form: 'Network error. Try again.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {errors.form && <FormError message={errors.form} />}

      <FieldWrap
        id="reg-name"
        label="Display name (optional)"
        error={errors.displayName}
      >
        <Input
          id="reg-name"
          placeholder="Ada Lovelace"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={INPUT_CLASS}
        />
      </FieldWrap>

      <FieldWrap id="reg-email" label="Email" error={errors.email}>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            className={`${INPUT_CLASS} pl-9`}
          />
        </div>
      </FieldWrap>

      <FieldWrap id="reg-password" label="Password" error={errors.password}>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          className={INPUT_CLASS}
        />
      </FieldWrap>

      <FieldWrap
        id="reg-confirm"
        label="Confirm password"
        error={errors.confirm}
      >
        <Input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!errors.confirm}
          className={INPUT_CLASS}
        />
      </FieldWrap>

      <SubmitButton
        submitting={submitting}
        icon={<UserPlus className="h-4 w-4" />}
      >
        Create account
      </SubmitButton>
    </form>
  )
}

/* ---------------- Forgot password ---------------- */

function ForgotPasswordBlock({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState<'request' | 'reset' | 'done'>('request')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function requestReset(ev: React.FormEvent) {
    ev.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const rows = await api.forgotPassword(email)
      const t = (rows[0] as { token?: string } | undefined)?.token
      if (t) {
        setToken(t)
        setStage('reset')
        toast.success('Reset token generated (dev mode)')
      } else {
        setStage('done')
        toast.success('If that email exists, a reset link has been sent.')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  async function doReset(ev: React.FormEvent) {
    ev.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!token) {
      setError('Token is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.resetPassword(token, newPassword)
      toast.success('Password reset. You can log in now.')
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed.')
    } finally {
      setBusy(false)
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (stage === 'request') {
    return (
      <form
        onSubmit={requestReset}
        className="surface-3 space-y-2 rounded-md p-3"
      >
        <FieldLabel htmlFor="forgot-email">Reset email</FieldLabel>
        {error && <ShakeError message={error} />}
        <div className="flex gap-2">
          <Input
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 bg-surface-2 text-sm focus-visible:ring-brand"
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Send'
            )}
          </button>
        </div>
      </form>
    )
  }

  if (stage === 'reset') {
    return (
      <form
        onSubmit={doReset}
        className="surface-3 space-y-3 rounded-md p-3"
      >
        <div className="flex items-start gap-2 text-[11px] text-brand">
          <span className="brand-dot mt-1 shrink-0" />
          <span>
            In production this would be emailed. Use this token to reset:
          </span>
        </div>

        <div className="font-mono rounded bg-background/40 p-2 text-xs">
          <div className="flex items-center gap-1">
            <code className="flex-1 truncate text-muted-foreground">{token}</code>
            <button
              type="button"
              onClick={copyToken}
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-brand"
              title="Copy token"
            >
              {copied ? (
                <Check className="h-3 w-3 text-brand" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>

        {error && <ShakeError message={error} />}

        <div className="space-y-1.5">
          <FieldLabel htmlFor="reset-token">Token</FieldLabel>
          <Input
            id="reset-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-8 bg-surface-2 font-mono text-xs focus-visible:ring-brand"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="reset-pw">New password</FieldLabel>
          <Input
            id="reset-pw"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-8 bg-surface-2 text-sm focus-visible:ring-brand"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand py-1.5 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <KeyRound className="h-3 w-3" />
          )}
          Reset password
        </button>
      </form>
    )
  }

  return (
    <div className="surface-3 flex items-start gap-2 rounded-md p-3 text-[11px] text-muted-foreground">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
      <div>
        <p className="font-medium text-foreground">Reset email sent.</p>
        <p>If that email exists, a reset link has been sent.</p>
        <button
          type="button"
          onClick={onDone}
          className="mt-1.5 flex items-center gap-1 text-xs text-brand hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to login
        </button>
      </div>
    </div>
  )
}
