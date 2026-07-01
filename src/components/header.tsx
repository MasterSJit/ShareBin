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
import { Code2, FileCode, Home, LogOut, Moon, Search, Shield, Sun, User as UserIcon, LayoutDashboard } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

export function Header() {
  const { view, goHome, goBrowse, goDashboard, goAdmin, goLogin, goRegister, user, setUser, setLoadingUser } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // next-themes resolves the theme only after hydration; we need a re-render
  // once mounted so the icon matches. This is the canonical pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // Load current user on mount
  useEffect(() => {
    let active = true
    setLoadingUser(true)
    api.me()
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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <button
          onClick={goHome}
          className="flex items-center gap-2 font-bold text-foreground hover:opacity-80 transition"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileCode className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">PasteShare</span>
        </button>

        <nav className="ml-2 flex items-center gap-1">
          <Button
            variant={isActive('home') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={goHome}
            className="gap-1.5"
          >
            <Home className="h-4 w-4" /> <span className="hidden sm:inline">New</span>
          </Button>
          <Button
            variant={isActive('browse') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={goBrowse}
            className="gap-1.5"
          >
            <Search className="h-4 w-4" /> <span className="hidden sm:inline">Browse</span>
          </Button>
          {user && (
            <Button
              variant={isActive('dashboard') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={goDashboard}
              className="gap-1.5"
            >
              <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button
              variant={isActive('admin') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={goAdmin}
              className="gap-1.5"
            >
              <Shield className="h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                  {user.role === 'admin' && (
                    <Badge variant="secondary" className="hidden md:inline text-[10px] px-1 py-0">admin</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.displayName || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goDashboard}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                {user.role === 'admin' && (
                  <DropdownMenuItem onClick={goAdmin}>
                    <Shield className="mr-2 h-4 w-4" /> Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={goLogin}>
                <UserIcon className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Log in</span>
              </Button>
              <Button size="sm" onClick={goRegister} className="gap-1.5">
                <Code2 className="h-4 w-4" /> <span className="hidden sm:inline">Sign up</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
