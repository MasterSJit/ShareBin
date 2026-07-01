'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  LogIn,
  UserPlus,
  KeyRound,
  Copy,
  Check,
  Mail,
  FileCode,
  Sparkles,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { Reveal, scaleIn } from '@/components/motion-helpers'
import type { SafeUser } from '@/lib/types'

type Mode = 'login' | 'register'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthView({ mode }: { mode: Mode }) {
  const { goLogin, goRegister } = useAppStore()

  function onTabChange(v: string) {
    if (v === 'login') goLogin()
    else goRegister()
  }

  return (
    <div className="relative flex-1 items-center justify-center px-4 py-6 flex">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Animated brand mark */}
        <Reveal variant={scaleIn} className="mb-4 flex flex-col items-center gap-2 sm:mb-6 sm:gap-3">
          <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
            {/* rotating conic-gradient ring */}
            <div
              className="animate-spin-slow absolute inset-0 rounded-full opacity-80"
              style={{
                background:
                  'conic-gradient(from 0deg, var(--brand), var(--brand-2), oklch(0.7 0.2 330), var(--brand))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))',
                WebkitMask:
                  'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))',
              }}
            />
            {/* glow */}
            <div className="animate-pulse-glow absolute inset-0 rounded-full bg-brand/30 blur-xl" />
            {/* core */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 shadow-lg shadow-brand/40"
            >
              <FileCode className="h-7 w-7 text-brand-foreground" />
            </motion.div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient-animated">PasteShare</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Share code & files, beautifully.
            </p>
          </div>
        </Reveal>

        {/* Tabs */}
        <Reveal variant={scaleIn} delay={0.05} className="mb-4">
          <Tabs value={mode} onValueChange={onTabChange}>
            <TabsList className="glass grid w-full grid-cols-2 rounded-xl p-1">
              <TabsTrigger
                value="login"
                className="gap-1.5 rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand data-[state=active]:to-brand-2 data-[state=active]:text-brand-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-brand/30"
              >
                <LogIn className="h-4 w-4" /> Log in
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="gap-1.5 rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand data-[state=active]:to-brand-2 data-[state=active]:text-brand-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-brand/30"
              >
                <UserPlus className="h-4 w-4" /> Sign up
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Reveal>

        <Reveal variant={scaleIn} delay={0.1}>
          <div className="glass-strong gradient-border rounded-2xl p-5 glow-brand sm:p-6">
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </Reveal>
      </div>
    </div>
  )
}

function ShakeError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <motion.p
      initial={{ x: 0 }}
      animate={{ x: [0, -6, 6, -4, 4, 0] }}
      transition={{ duration: 0.35 }}
      className="mt-1.5 flex items-center gap-1 text-xs font-medium text-destructive"
    >
      {message}
    </motion.p>
  )
}

function FieldWrap({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <ShakeError message={error} />
    </div>
  )
}

function LoginForm() {
  const { setUser, goHome, goRegister } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
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
        toast.success('Welcome back ✨')
        goHome()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setErrors({ form: 'Invalid email or password.' })
        else if (err.status === 429) setErrors({ form: 'Too many attempts. Wait a minute.' })
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
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-xs text-muted-foreground">Log in to manage your pastes.</p>
      </div>

      {errors.form && (
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 0.35 }}
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {errors.form}
        </motion.div>
      )}

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
            className="bg-muted/30 pl-9 focus-visible:ring-2 focus-visible:ring-brand"
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
          className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
        />
      </FieldWrap>

      <Button
        type="submit"
        disabled={submitting}
        className="btn-shine relative w-full gap-2 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30 transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Log in
      </Button>

      <button
        type="button"
        onClick={() => setShowForgot((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand"
      >
        <KeyRound className="h-3 w-3" /> Forgot password?
      </button>

      {showForgot && <ForgotPasswordBlock onDone={() => setShowForgot(false)} />}

      <div className="flex items-center gap-2 rounded-lg glass p-3 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" />
        <span className="flex-1">
          Demo admin: <code className="font-mono text-foreground">admin@pasteshare.local</code> /{' '}
          <code className="font-mono text-foreground">admin123</code>
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] hover:border-brand/50 hover:text-brand"
          onClick={fillDemo}
        >
          Fill
        </Button>
      </div>

      <Separator />
      <div className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={goRegister}
          className="font-semibold text-foreground transition-colors hover:text-brand"
        >
          Sign up
        </button>
      </div>
    </form>
  )
}

function RegisterForm() {
  const { setUser, goHome, goLogin } = useAppStore()
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
    else if (password.length < 8) e.password = 'Password must be at least 8 characters.'
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
        toast.success('Account created 🎉')
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
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Create your account</h2>
        <p className="text-xs text-muted-foreground">Free, no credit card required.</p>
      </div>

      {errors.form && (
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 0.35 }}
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {errors.form}
        </motion.div>
      )}

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
          className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
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
            className="bg-muted/30 pl-9 focus-visible:ring-2 focus-visible:ring-brand"
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
          className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
        />
      </FieldWrap>

      <FieldWrap id="reg-confirm" label="Confirm password" error={errors.confirm}>
        <Input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!errors.confirm}
          className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
        />
      </FieldWrap>

      <Button
        type="submit"
        disabled={submitting}
        className="btn-shine relative w-full gap-2 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30 transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Create account
      </Button>

      <Separator />
      <div className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button
          type="button"
          onClick={goLogin}
          className="font-semibold text-foreground transition-colors hover:text-brand"
        >
          Log in
        </button>
      </div>
    </form>
  )
}

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
      <div className="space-y-2 rounded-lg glass p-3">
        <Label htmlFor="forgot-email" className="text-xs flex items-center gap-1">
          <Mail className="h-3 w-3" /> Reset email
        </Label>
        {error && <ShakeError message={error} />}
        <div className="flex gap-2">
          <Input
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 bg-muted/30 text-sm focus-visible:ring-2 focus-visible:ring-brand"
          />
          <Button
            size="sm"
            onClick={requestReset}
            disabled={busy}
            className="shrink-0 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </div>
    )
  }

  if (stage === 'reset') {
    return (
      <div className="space-y-2 rounded-lg glass p-3">
        <div className="flex items-start gap-2 rounded-md bg-brand/10 px-2.5 py-1.5 text-[11px] text-brand">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            In production this would be emailed. Use this token to reset:
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-brand/30 bg-background/60 px-2 py-1.5">
          <code className="flex-1 truncate font-mono text-[11px]">{token}</code>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:text-brand"
            onClick={copyToken}
            title="Copy token"
          >
            {copied ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        {error && <ShakeError message={error} />}
        <div className="space-y-1">
          <Label htmlFor="reset-token" className="text-[11px]">Token</Label>
          <Input
            id="reset-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-8 bg-muted/30 font-mono text-xs focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reset-pw" className="text-[11px]">New password</Label>
          <Input
            id="reset-pw"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-8 bg-muted/30 text-sm focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <Button
          size="sm"
          className="w-full gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
          onClick={doReset}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
          Reset password
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg glass p-3 text-[11px] text-muted-foreground">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
      <div>
        <p className="font-medium text-foreground">Reset email sent.</p>
        <p>If that email exists, a reset link has been sent.</p>
        <button
          onClick={onDone}
          className="mt-1.5 flex items-center gap-1 text-xs text-brand hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to login
        </button>
      </div>
    </div>
  )
}
