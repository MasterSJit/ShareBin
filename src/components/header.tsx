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
  Code2,
  FileCode,
  Home,
  LogOut,
  Moon,
  Search,
  Shield,
  Sun,
  User as UserIcon,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
  } = useAppStore()
  const { theme, setTheme } = useTheme()
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
    { name: 'home', label: 'New', icon: Home, onClick: goHome },
    { name: 'browse', label: 'Browse', icon: Search, onClick: goBrowse },
    ...(user
      ? [{ name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, onClick: goDashboard }]
      : []),
    ...(user?.role === 'admin'
      ? [{ name: 'admin', label: 'Admin', icon: Shield, onClick: goAdmin }]
      : []),
  ]

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="glass-strong border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
          {/* Logo */}
          <motion.button
            onClick={goHome}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-2.5 font-bold"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30">
              <FileCode className="h-4.5 w-4.5" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand to-brand-2 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-60" />
            </div>
            <span className="hidden text-lg tracking-tight sm:inline">
              Paste<span className="text-gradient">Share</span>
            </span>
          </motion.button>

          {/* Nav */}
          <nav className="ml-3 flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(item.name)
              return (
                <motion.div
                  key={item.name}
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                  className="relative"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={item.onClick}
                    className={`gap-1.5 rounded-lg transition-colors ${
                      active
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                  {active && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-brand to-brand-2"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.div>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Toggle theme"
                className="rounded-lg"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {mounted && theme === 'dark' ? (
                    <motion.span
                      key="sun"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Sun className="h-4 w-4" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="moon"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Moon className="h-4 w-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="ghost" size="sm" className="gap-2 rounded-lg px-2">
                      <Avatar className="h-7 w-7 ring-2 ring-brand/20">
                        <AvatarFallback className="bg-gradient-to-br from-brand/20 to-brand-2/20 text-xs font-semibold text-foreground">
                          {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-[120px] truncate md:inline">
                        {user.displayName || user.email}
                      </span>
                      {user.role === 'admin' && (
                        <Badge
                          variant="secondary"
                          className="hidden bg-brand/15 text-brand md:inline"
                        >
                          admin
                        </Badge>
                      )}
                    </Button>
                  </motion.div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong w-56">
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
                  className="rounded-lg"
                >
                  <UserIcon className="mr-1 h-4 w-4" />{' '}
                  <span className="hidden sm:inline">Log in</span>
                </Button>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-shine"
                >
                  <Button
                    size="sm"
                    onClick={goRegister}
                    className="gap-1.5 rounded-lg bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/25 hover:shadow-brand/40"
                  >
                    <Sparkles className="h-4 w-4" />{' '}
                    <span className="hidden sm:inline">Sign up</span>
                  </Button>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
