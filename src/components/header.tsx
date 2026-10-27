'use client'

import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  FileCode,
  Home,
  LogOut,
  Moon,
  Search,
  Shield,
  Sun,
  User as UserIcon,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePublicSettings } from '@/hooks/use-public-settings'

export function Header() {
  const {
    view,
    goHome,
    goBrowse,
    goDashboard,
    goAdmin,
    goLogin,
    goRegister,
    user,
    setUser,
    setLoadingUser,
    back,
    canGoBack,
  } = useAppStore()
  const { theme, setTheme } = useTheme()
  const { settings } = usePublicSettings()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Load current user on mount
  useEffect(() => {
    let active = true
    setLoadingUser(true)
    api
      .me()
      .then((rows) => {
        if (active && rows[0]) setUser(rows[0])
      })
      .catch(() => {
        /* not logged in */
      })
      .finally(() => {
        if (active) setLoadingUser(false)
      })
    return () => {
      active = false
    }
  }, [setUser, setLoadingUser])

  async function handleLogout() {
    try {
      await api.logout()
      setUser(null)
      goHome()
      toast.success('Logged out')
    } catch {
      toast.error('Logout failed')
    }
  }

  const isActive = (name: string) => view.name === name

  const navItems = [
    { name: 'home', label: 'New', icon: Plus, onClick: goHome },
    { name: 'browse', label: 'Browse', icon: Search, onClick: goBrowse },
    ...(user
      ? [{ name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, onClick: goDashboard }]
      : []),
    ...(user?.role === 'admin'
      ? [{ name: 'admin', label: 'Admin', icon: Shield, onClick: goAdmin }]
      : []),
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4 sm:px-6">
        {/* Back / forward (browser history) */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={back}
            title="Go back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Logo */}
        <motion.button
          onClick={goHome}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="group flex items-center gap-2 font-bold"
        >
          {settings.logoUrl && settings.logoUrl !== '/logo.svg' ? (
            // Custom logo image
            <img src={settings.logoUrl} alt={settings.siteName} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            // Default logo (gradient square with FileCode icon)
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-lg shadow-brand/30">
              <FileCode className="h-4 w-4" />
            </div>
          )}
          <span className="hidden text-base tracking-tight sm:inline">
            {settings.siteName}
          </span>
        </motion.button>

        {/* Nav */}
        <nav className="ml-2 flex items-center gap-0.5">
          {navItems.map((item) => {
            const active = isActive(item.name)
            return (
              <Button
                key={item.name}
                variant="ghost"
                size="sm"
                onClick={item.onClick}
                className={`relative gap-1.5 rounded-md text-[13px] transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute -bottom-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mounted && theme === 'dark' ? (
                <motion.span
                  key="sun"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <Sun className="h-4 w-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <Moon className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-md px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-brand/15 text-[11px] font-semibold text-brand">
                      {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[110px] truncate text-[13px] md:inline">
                    {user.displayName || user.email}
                  </span>
                  {user.role === 'admin' && (
                    <Badge className="hidden bg-brand/15 px-1 text-[10px] text-brand md:inline">
                      admin
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.displayName || 'User'}
                    </p>
                    <p className="truncate text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goDashboard} className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                {user.role === 'admin' && (
                  <DropdownMenuItem onClick={goAdmin} className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" /> Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={goLogin}
                className="rounded-md text-[13px]"
              >
                Log in
              </Button>
              <Button
                size="sm"
                onClick={goRegister}
                className="btn-shine rounded-md bg-brand text-brand-foreground hover:bg-brand/90"
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
