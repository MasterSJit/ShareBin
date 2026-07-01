'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Loader2, LogIn, UserPlus, KeyRound, Copy, Check, Info, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
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
    <div className="flex-1 bg-muted/20 px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Tabs value={mode} onValueChange={onTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="gap-1.5">
              <LogIn className="h-4 w-4" /> Log in
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Sign up
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="mt-4">
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
        </Card>
      </div>
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
        toast.success('Welcome back')
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

  return (
    <>
    <CardHeader>
      <CardTitle>Welcome back</CardTitle>
      <CardDescription>Log in to manage your pastes.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.form && (
          <Alert variant="destructive">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Log in
        </Button>

        <button
          type="button"
          onClick={() => setShowForgot((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
        >
          <KeyRound className="h-3 w-3" /> Forgot password?
        </button>

        {showForgot && <ForgotPasswordBlock onDone={() => setShowForgot(false)} />}

        <Separator />
        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button type="button" onClick={goRegister} className="font-medium text-foreground hover:underline">
            Sign up
          </button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Demo credentials</AlertTitle>
          <AlertDescription>
            <code className="font-mono text-xs">admin@pasteshare.local</code> /{' '}
            <code className="font-mono text-xs">admin123</code>
          </AlertDescription>
        </Alert>
      </form>
    </CardContent>
    </>
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
    <>
    <CardHeader>
      <CardTitle>Create your account</CardTitle>
      <CardDescription>Free, no credit card required.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.form && (
          <Alert variant="destructive">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="reg-name">Display name <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            id="reg-name"
            placeholder="Ada Lovelace"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-email">Email</Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-password">Password</Label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-confirm">Confirm password</Label>
          <Input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
          />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Create account
        </Button>

        <Separator />
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button type="button" onClick={goLogin} className="font-medium text-foreground hover:underline">
            Log in
          </button>
        </div>
      </form>
    </CardContent>
    </>
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
      <div className="rounded-md border border-border/70 bg-muted/30 p-3 space-y-2">
        <Label htmlFor="forgot-email" className="text-xs flex items-center gap-1">
          <Mail className="h-3 w-3" /> Reset email
        </Label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Input
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={requestReset} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </div>
    )
  }

  if (stage === 'reset') {
    return (
      <div className="rounded-md border border-border/70 bg-muted/30 p-3 space-y-2">
        <Alert className="py-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            In production this would be emailed. Use this token to reset:
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-1 rounded border bg-background px-2 py-1">
          <code className="font-mono text-[11px] flex-1 truncate">{token}</code>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyToken} title="Copy token">
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="space-y-1">
          <Label htmlFor="reset-token" className="text-xs">Token</Label>
          <Input
            id="reset-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reset-pw" className="text-xs">New password</Label>
          <Input
            id="reset-pw"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Button size="sm" className="w-full" onClick={doReset} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
          Reset password
        </Button>
      </div>
    )
  }

  return (
    <Alert className="py-2">
      <Check className="h-4 w-4 text-emerald-500" />
      <AlertDescription className="text-xs">
        If that email exists, a reset link has been sent.
      </AlertDescription>
    </Alert>
  )
}
